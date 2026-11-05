# Stage: atomic sandbox checkout order (NOT a production release)

Date: 2026-11-05. Repository: `one2pret/onetone-store`.
This branch adds a **separate staging-only** `POST /api/checkout/sandbox-order`.
The existing storefront `POST /api/orders` is unchanged (and still requires its own hardening).
Flutter `Buat Pesanan` remains disabled until staged order UAT is complete.

## Scope

- Reuses fresh authenticated Biteship selection/price from PR #61 and verifies cart/address snapshot inside a locked MySQL transaction.
- Atomic DB transaction inserts order, order items, shipping, inventory movements, conditionally updates online inventory and variant/product stock, and clears customer cart. A failure rolls back **all** mutations.
- `Idempotency-Key: <UUID>` maps to a stable unique order number for each user. Reusing the same UUID returns the previously created order/payment status rather than creating duplicate inventory changes or remote invoices.
- Invoice is created through Xendit **after** the transaction commits, with a unique external ID. Successful invoices are recorded in the `invoices` table and payment URL returned.
- On timeout or invoice DB error, returns `202 payment_setup_pending`: the order already exists, stock already changed, and **operator reconciliation is required**. Do not start another payment with a new UUID; repeated UUID does not retry the Xendit remote call.

## Strict activation requirements

Both conditions must be true at runtime:
- `CHECKOUT_SANDBOX_ORDER_ENABLED=true`
- Xendit secret starts with `xnd_development_` (development credential, never live).

**Defaults to HTTP 404 when disabled. Do not set this flag on production; do not merge the flag into `ENV_PROD`.** These checks reduce risk, but are not a substitute for infrastructure environment isolation or webhook security review.

Do not send Xendit keys, API tokens, personal data, or `.env.app` to chat/PR. Staging GitHub Actions rewrites `.env.app` from `ENV_TEST` on every main deployment, so modify only approved staging secrets/variables using the operations runbook.

## Request example (only after explicit staging enablement)

Authenticated Bearer session of disposable staging customer, whose owned address and cart are valid. Generate a UUID once **per checkout attempt** and reuse it on retries; never generate a new UUID after a timeout.

```
POST /api/checkout/sandbox-order
Authorization: Bearer <STAGING_CUSTOMER_TOKEN>
Idempotency-Key: <UUID>
Content-Type: application/json

{
  "addressId": 123,
  "courierCompany": "anteraja",
  "courierType": "reg",
  "courierPrice": 7300,
  "notes": "UAT staging"
}
```

Codes and price come from `POST /api/shipping/rates`, not hard-coded display labels.

## Expected outcomes

| Scenario | Expected |
|---|---|
| Flag disabled or Xendit non-development key | 404, no mutations |
| Anonymous | 401 |
| Invalid/missing UUID or body | 400 |
| Foreign address | 404 |
| Changed courier/price or cart/address during quote | 409, no mutations |
| Invalid/missing stock/weight or cart empty | 409/422, no mutations |
| Successful sandbox order+invoice | 201 with orderId/orderNumber/paymentUrl |
| Exact retry with same UUID | 200 with existing order/paymentUrl; or 202 if payment setup requires reconciliation |
| Xendit timeout or DB invoice write failure | 202 `payment_setup_pending`; do NOT blindly retry with another UUID |
| Insufficient stock/concurrent orders | only one succeeds; other fails; no negative stock |
| Any DB transaction failure | no partial order/item/stock/cart changes |

## Manual UAT gates before enabling mobile submit

1. Confirm CI/typecheck/tests, sandbox Xendit credentials, sandbox callback token and provider webhook registration. Do NOT test with real customer accounts or charge real cards.
2. Back up staging DB. Use a disposable test customer and test product with positive gram weight and known online inventory balance.
3. Verify stock before order in `products` or `product_variants` **and** `inventory_balances`; verify inventory movements and cart clear after 201.
4. Retry same idempotency UUID: no second order, invoice or stock decrement.
5. Force a stale quote and zero stock: 409/422, no order created.
6. Simulate Xendit failure in a controlled test environment; verify status 202 and use operator reconciliation (not automatic invoice reissue).
7. Pay in Xendit sandbox: verify webhook `PAID` transitions order once to `packing`. Send duplicate and out-of-order callbacks; verify no duplicate stock/restoration, commissions or points.
8. Verify invoice `EXPIRED` restores stock only once; test concurrent PAID/EXPIRED delivery to expose state-race issues.
9. Regression: website's existing order flow plus Flutter login, cart, addresses and shipping quote. Existing web route is **not** secured by this PR and must be hardened separately.
10. Only then wire Flutter submit behind a testing-only feature flag and distribute signed testing APK. Production promotion needs separate approval after all checkout/security gates.

## Important remaining blockers

- The existing `app/api/webhooks/xendit/route.ts` still has a read-then-write idempotency check and separate non-atomic side effects. Hardening callback concurrency and reconciliation is required before **payment success** can be considered reliable.
- Remote invoice creation and local invoice save are not atomic. Ambiguous Xendit responses require manual provider lookup/reconciliation.
- The existing web `POST /api/orders` still accepts client courierPrice and non-atomic stock writes. This PR does not change existing web behavior; production full-commerce launch must address it.
- Legacy stock writers may bypass this new user lock. Verify cross-channel concurrency under actual staging load.
- Current invoice/stock expiry and order cancellation logic must be audited for repeat and out-of-order events.

## Rollback

Unset `CHECKOUT_SANDBOX_ORDER_ENABLED` or set to `false` in the **staging** config source, redeploy only staging and verify the endpoint returns 404. Do not delete created sandbox orders or production data; reconcile pending sandbox invoices explicitly. Do not run `docker compose down -v`.
