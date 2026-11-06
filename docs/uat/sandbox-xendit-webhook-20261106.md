# Xendit sandbox invoice webhook UAT — Kanuraga staging

**Scope:** PR for a NEW route `POST /api/checkout/sandbox-xendit-webhook`, not a production launch.
The existing legacy `POST /api/webhooks/xendit` continues to handle ordinary web orders. It now rejects `SBX-` orders so they cannot accidentally use its non-atomic stock-restoration logic.

## Setup and safety

1. Confirm PR CI passes (TypeScript and unit tests) and automatic staging deploy from `main` completes.
2. Prepare a **test-mode** Xendit account. The sandbox order route and this webhook are gated by both `CHECKOUT_SANDBOX_ORDER_ENABLED=true` and a development-mode Xendit key (`xnd_development_...`). Leave this flag **false in production**.
3. Staging backend must have `XENDIT_WEBHOOK_TOKEN` set to the token configured for **test-mode** invoice callbacks. Never paste the value into GitHub PRs, chats, screenshots, or app logs.
4. In Xendit dashboard **Test Mode**, configure the **legacy Invoice callback** to `https://onetone.kanuraga.web.id/api/checkout/sandbox-xendit-webhook`. This project uses the legacy Invoice API wrapper (`lib/xendit.ts`), not the newer Payment Request `payment.capture` payload.
5. Enable **expired invoice** callbacks in Xendit dashboard if this option is presented. Carefully verify the live-mode callback URL remains unchanged.
6. `.github/workflows/deploy.yml` overwrites staging `.env.app` from GitHub Actions secret `ENV_TEST` on every `main` deploy. Update approved staging secret source to persist flags. **Never replace `ENV_TEST` without a complete safe copy**, because secrets cannot be read back from GitHub.
7. Do not enable the sandbox order endpoint until this callback route and test-mode callback configuration are both ready.

## Why separate endpoints?

- New route validates the `x-callback-token` using constant-time comparison, and only accepts invoice ID, `external_id=SBX-...`, IDR amount, and `PAID` or `EXPIRED` status.
- Locally stored invoice ID, its order number and its amount **must all match** the callback. It never trusts client-submitted totals.
- Transaction locks invoice and order. A repeated PAID/EXPIRED event becomes a no-op. PAID following EXPIRED or EXPIRED following PAID is **acknowledged but flagged for human reconciliation**; it does not reverse paid fulfillment.
- An EXPIRED callback restores the exact original `online_sale` movements to their original inventory location. Stock, invoice/order status, and status history are in **one DB transaction**, not scattered writes.
- On DB failure or invoice not found yet, responds non-2xx so Xendit can retry.
- **No loyalty points, affiliate commissions or voucher side effects are intentionally run on sandbox orders.** Normal legacy web orders are not handled by the new endpoint.

## Staging test cases

Use only disposable staging customers/products and test-mode Xendit keys. Record order numbers and HTTP statuses, never real tokens or private customer info.

| Scenario | Expected |
|---|---|
| Flag off or key not development | 404 |
| Missing/wrong Xendit callback token | 401 |
| Missing Xendit token config | 503 |
| Valid token, malformed body or wrong currency/amount/external ID | 422 |
| Invoice not yet saved locally | 503, retry requested |
| Valid PAID on pending SBX invoice | 200, invoice=paid, order=packing, **one** status log |
| Duplicate PAID (including after order advances) | 200, no second mutation/log |
| Valid EXPIRED on pending SBX invoice | 200, invoice=expired, order=expired; restore one time |
| Duplicate EXPIRED | 200, no second restore/log |
| EXPIRED after PAID, PAID after EXPIRED | 200 `manual_reconciliation_required`, no stock/status reversal; operator review |
| DB error during restore | 503 and **complete transaction rollback** |
| Callback accidentally sent to legacy path | 409 for SBX order; correct test-mode callback URL |
| Callback for ordinary web order at sandbox path | rejected, never changes web order |

## Reconciliation and operational review

- An order with `202 payment_setup_pending` from `/api/checkout/sandbox-order` has *already* been created and stock deducted. Query Xendit by external order number through an authorized operator workflow; do not create a new invoice blindly, and do not delete/recreate the order.
- Late **PAID after EXPIRED** means a refund/fulfillment decision is required; do not automatically re-deduct stock.
- If provider webhook processing cannot be completed, keep non-2xx replies and investigate server logs. Never acknowledge a database failure as success.
- This PR adds no admin reconciliation UI or durable outbox. Manual operator review is still required when side effects cannot be finalized or callbacks conflict.

## Rollback

Disable the staging `CHECKOUT_SANDBOX_ORDER_ENABLED` flag and redeploy, confirm endpoint returns 404. Correct the Xendit **test-mode** callback URL separately as needed. Do not alter the live callback. Never run `docker compose down -v`. Existing paid/unpaid sandbox orders need explicit reconciliation even after rollback.

## Blockers before full commerce launch

- Old web `POST /api/orders` still needs server-validated shipping, atomic stock and idempotency.
- Reconcile ambiguous Xendit invoice-create responses before enabling repeat purchase flows.
- Complete real staging integration UAT (one PAID and one EXPIRED invoice) and existing website regression.
- Then wire the testing-only Android `Buat Pesanan` button with a persistent retry UUID, order receipt and payment URL. No production app checkout until all gates pass.

References: [Xendit legacy invoice callbacks](https://docs.xendit.co/apidocs/set-webhook-url) and [Xendit webhook best practices](https://docs.xendit.co/docs/handling-webhooks).
