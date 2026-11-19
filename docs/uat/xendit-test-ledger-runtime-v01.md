# OneTone Checkout — Xendit TEST Payment Attempt Runtime v0.1

**Date:** 2026-11-19. **Review required; staging feature OFF by default.**

## Evidence and purpose

Owner staging read-only preflight passed: authenticated cart/address, JNE REG quote, inventory and freshQuote both PASS, forged courier price +Rp1 rejected HTTP 409. This was read-only, not an order/payment test. PR #82 extracted the sandbox transaction kernel; PR #83 added an unused `checkout_payment_attempts` schema and pure transition policy.

This PR wires a **separate opt-in** attempt ledger into the EXISTING `POST /api/checkout/sandbox-order` Xendit TEST invoice section. It must not affect the live storefront or Android production; it does NOT create a production order route.

## Behavior

- **Double gate:** old `CHECKOUT_SANDBOX_ORDER_ENABLED=true` with Xendit development key, plus separate `CHECKOUT_SANDBOX_PAYMENT_LEDGER_ENABLED=true`, `APP_ENV=staging` and development-key prefix. When ledger flag OFF, legacy sandbox behavior remains unchanged.
- Checkout order/items/shipping/inventory/cart still commit atomically with existing staging sandbox logic; a provider call remains OUTSIDE DB transaction.
- A new ledger reservation locks the order and validates ownership, total and `SBX-...` order number. It refuses a second payment attempt or an order with an existing invoice. In the same transaction it reserves and claims attempt #1, committing its `requesting` status BEFORE contacting Xendit.
- Xendit Invoice `externalId` is the order's stable `SBX-...` number, never a new ID on automatic retry. Redirect goes to the neutral sandbox-return page without order details or customer data.
- Successful provider response inserts `invoices` and transitions ledger to `ready` IN ONE transaction. If either database write fails, both roll back, the state becomes `needs_reconciliation`, and the API returns HTTP **202** without a second invoice call.
- Timeout, remote error, process crash or DB reservation failure is handled conservatively: no automatic re-POST to Xendit. If the process crashes while `requesting`, the record remains non-replayable. An operator must reconcile the provider outcome.
- For an existing order, the route's current retry behavior stays: it returns the stored invoice link or HTTP 202 pending; no fresh Biteship request, stock deduction or Xendit POST on the same idempotency key.
- No automatic settlement/EXPIRED transition is added to ledger yet; existing signed sandbox webhook continues handling order/stock via the existing processor. Ledger PAID/EXPIRED reconciliation is a **separate** required milestone.

## Code and CI gates

- `lib/checkout/sandbox-payment-attempt-store.ts`: order lock, unique reservation, conditional claim, unknown outcome, transactional invoice/ledger persistence.
- `lib/checkout/sandbox-payment-invoice-service.ts`: Xendit TEST service, strict feature gate and evidence hash.
- Unit tests: disabled/live-key/production guards; one-time claim; timeout and failed DB writes; neutral browser return URL.
- Real, disposable LOCAL MySQL test: two concurrent claims (one winner), ready invoice atomic persistence, duplicate attempt rejection, timeout reconciliation and rollback when the invoice ID conflicts.
- No actual Xendit TEST call in CI; mocked provider. `SANDBOX_BOOKING_TEST_DATABASE_URL` is restricted to local test DB.

## Controlled staging UAT after CI and owner review

1. Review, merge this PR to `main` and verify staging deploy PASS. **Default ledger flag OFF**. Do NOT deploy `production` branch.
2. Confirm preflight flag is **OFF** from the completed preflight UAT; independent checkout ledger testing does not require preflight ON.
3. Backup staging DB. Prepare disposable staging-only customer, product/stock, address and Biteship TEST rates. Confirm Xendit key is development format WITHOUT printing it.
4. GitHub → Settings → Secrets and variables → Actions → Variables: set `CHECKOUT_SANDBOX_PAYMENT_LEDGER_ENABLED_TEST=true`. Existing `CHECKOUT_SANDBOX_ORDER_ENABLED_TEST=true` is ALSO required for the sandbox route, and itself creates orders/deducts staging stock. Set both only with explicit approved TEST UAT; do not touch `ENV_PROD`.
5. GitHub Actions → Build & Deploy onetone-store → Run workflow → branch `main`, `staging_only_confirm=true`. Confirm only Testing job ran, runtime `APP_ENV=staging` and both staging flags true.
6. Use **TEST APK** configured to `https://onetone.kanuraga.web.id` or a trusted staging API client, NEVER the production APK. Run one order with stable UUID `Idempotency-Key` and a fresh server-trusted quote. Expect HTTP 201 + one new `SBX-...` order, one `checkout_payment_attempts` row status `ready`, one invoice and one `online_sale` stock movement per line.
7. Retry SAME UUID, expect same order/payment link or HTTP 202 reconciliation, and **no second invoice/stock deduction**. Concurrent duplicate request test with disposable TEST data also must yield exactly one claim.
8. Xendit TEST complete PAID/EXPIRED, verify existing signed webhook changes order and inventory once. Compare ledger outcome with provider. PAID/EXPIRED ledger transitions are NOT yet implemented; flag the mismatch for next phase, do not claim complete ledger reconciliation.
9. For simulated provider timeout/DB failure, expect 202 and retained `needs_reconciliation` or `requesting`, no automatic new Xendit attempt. Manual provider lookup (never blindly retry) is still required. Do NOT induce faults against live credentials.
10. Collect order/invoice/attempt/stock counts (redact emails/IDs in screenshots). Record results and rollback flags if any mismatch.

## Turn OFF / rollback

1. Set `CHECKOUT_SANDBOX_PAYMENT_LEDGER_ENABLED_TEST=false` and, if not needed for other sandbox UAT, `CHECKOUT_SANDBOX_ORDER_ENABLED_TEST=false`.
2. Manually deploy staging only via `main` with `staging_only_confirm=true`, verify both flags OFF in app container; sandbox order route should return 404 when its parent gate is OFF.
3. **Never delete existing orders, invoices, ledger attempts or stock movements** to roll back. If there is an unknown provider result, reconcile with Xendit TEST before allowing a new attempt.
4. Do not enable live keys or checkout production. PR can be reverted if needed without reverting migration #0019, which may now contain durable records.

## Still needed before Android Production live

- Durable provider lookup/reconciliation; signed webhook synchronization to ledger statuses, exactly-once stock and points/vouchers/affiliate lifecycles.
- Legacy `POST /api/orders` AND web Server Action `app/actions/orders.ts` still require rework; these are NOT protected by this change.
- Full staging negative/race tests and explicit owner go/no-go, controlled live Biteship testing, release flags and rollback.
