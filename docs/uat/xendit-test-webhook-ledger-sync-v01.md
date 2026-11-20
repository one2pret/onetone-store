# Xendit TEST webhook → Payment Attempt Ledger sync (v0.1)

**Branch:** fix/xendit-test-webhook-ledger-sync-v01
**Scope:** `SBX-` sandbox invoices only; no production checkout changes.

## Motivation and verified baseline

The operator's staging payment TEST showed:
- One order, one invoice, one payment attempt and one `online_sale -1` movement after replaying the same checkout idempotency UUID.
- Subsequent simulated PAID: order `packing`, invoice `paid`, but attempt still `ready`.
- Existing `processSandboxInvoiceEvent` updates invoice/order/stock/logs in one transaction but never touches the attempt ledger.

## Implementation

- The existing Xendit `x-callback-token` authentication, strict SBX externalId parsing, invoice ID, amount and order identity checks remain in place.
- In the SAME `db.transaction`, lock the matching order's payment-attempt rows, allowing **zero rows** for legacy SBX orders. If a ledger row exists, require `mode=sandbox`, matching externalId, stored Xendit invoice ID and amount.
- Reject identity mismatch and multiple attempts without modifying invoice, order, ledger or stock; future repay requires a separate explicit active-attempt selection policy.
- On authenticated PAID, transition `ready → paid`. On EXPIRED, transition `ready → expired`. A `needs_reconciliation` row may be resolved by a matching signed provider event.
- A callback that is a duplicate for the invoice/order can bring the matching ledger from `ready` to its terminal state while leaving order logs, stock and fulfillment unchanged. A replay with a terminal ledger is a no-op.
- Cross-terminal or otherwise illegal ledger transitions are conflicts requiring operator review; no silent overwrite. Any database failure rolls back *all* effects and returns 503 for retry.
- The sync runs even if the separate ledger-creation flag is now OFF, because previously created invoices can still receive delayed callbacks. The sandbox **parent** gate and development Xendit key remain enforced at both public callback routes.

## Validation

- Pure policy tests for ready, reconciliation, replays and forbidden transitions.
- Real, disposable local MySQL 8 regression uses the actual `processSandboxInvoiceEvent`:
  - concurrent PAID twice → one order transition, one audit event, one ledger PAID
  - concurrent EXPIRED twice → one return movement, one restock, one ledger EXPIRED
  - delayed PAID after EXPIRED → conflict and no reversal
  - pre-ledger sandbox order → legacy behavior unchanged
  - previously PAID order with READY ledger → duplicate callback repairs ledger only
  - wrong provider Xendit ID → fail closed and no writes
  - failed stock restoration → transaction rollback preserves pending invoice, waiting order and ready ledger
- Tests use NO Xendit network calls, customer data, or live credentials.

## Staging UAT plan after review and merge

1. Confirm PR CI PASS; review and merge to `main`, verify successful staging-only deployment. Do not deploy the `production` branch. Back up staging DB before new provider tests.
2. Verify `APP_ENV=staging`, `CHECKOUT_SANDBOX_ORDER_ENABLED=true` and Xendit development key (never print key/token). The separate ledger-creation flag is only required to create NEW ledger-backed TEST invoices, not to sync an existing attempt.
3. For the **already PAID** sandbox order used in the owner's earlier UAT, **do not** create a second order or change records with SQL. If Xendit dashboard offers a supported **resend webhook** for its invoice, resend the original authenticated `PAID` event. Verify order remains packing, invoice paid, ledger changes from ready to paid and no extra `return`, `online_sale` or status log. A redirect/browser page is NOT proof of payment.
4. For a NEW disposable EXPIRED test, create a separate order and one payment-attempt ledger, leave its invoice unpaid, wait until confirmed EXPIRED in Xendit TEST, then verify matching signed callback changes invoice/order/ledger to expired, with exactly one original `online_sale` and one `return`. Resend EXPIRED and confirm counts unchanged.
5. In MySQL staging, use read-only queries tied to the private order ID; never share token, invoice URL, full order number or customer details:

```sql
SELECT o.id, o.status AS order_status, i.invoice_status,
       a.status AS attempt_status
FROM orders o
JOIN invoices i ON i.order_id = o.id
LEFT JOIN checkout_payment_attempts a ON a.order_id=o.id
WHERE o.id = ?;

SELECT type, COUNT(*) AS movements, SUM(quantity_delta) AS qty_delta
FROM inventory_movements
WHERE reference_type='order' AND reference_id=?
GROUP BY type;
```

6. If the historical PAID event cannot be resent, record it for provider-backed administrative reconciliation. Do not forge an unauthenticated webhook, manually UPDATE ledger or overwrite a terminal state.

## Rollback and boundaries

- No migration: this uses the existing `checkout_payment_attempts` table from PR #83.
- Do not change `ENV_PROD`, invoke live Xendit credentials, create/delete production orders, or run a sandbox checkout on a production APK.
- Keep the parent sandbox-order webhook gate enabled while awaiting callbacks for active TEST invoices; after UAT and provider reconciliation, disable staging flags via GitHub Variables and staging-only deployment.
- Legacy web and production checkout have different voucher, points, affiliate, inventory logic; this change does NOT protect or activate them. No Biteship booking changes.
