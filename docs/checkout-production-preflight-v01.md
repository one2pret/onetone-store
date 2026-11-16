# Checkout Production Hardening — Phase 1: STAGING read-only preflight

**Date:** 2026-11-16 · **Status:** Draft PR, not a production checkout release.

## Audit of main (source observations)

The legacy `POST /api/orders` accepts client-supplied `courierPrice`, writes order/items/shipping/stock/cart separately without one DB transaction, then may return `201 success` even if remote Xendit invoice creation fails. `lib/stock.ts` also performs read-then-write inventory updates outside a shared transaction. The storefront web UI uses a **separate** server action `app/actions/orders.ts`, which needs its **own** checkout and voucher/points audit. The successful staging `POST /api/checkout/sandbox-order` already uses an atomic transaction and idempotency, but does not yet constitute approval for live sales.

## Storefront web checkout also requires hardening

The customer website's `CheckoutForm.tsx` invokes the **Server Action**
`app/actions/orders.ts:createOrder`, not the mobile legacy `POST /api/orders` route.
Direct source audit found:

- `courierPrice` is read from `FormData` and used in totals before a server-owned fresh Biteship rate match.
- The DB transaction only covers the first order insert, voucher reservation and points deduction. Order items, shipping row, affiliate click update, stock movement, cart clearing and the Xendit invoice happen **after** that transaction as separate operations. A later exception can leave an incomplete order or inconsistent stock/points.
- Invoice errors are caught, yet the Server Action returns `{ success: true, orderId, paymentUrl }` (where `paymentUrl` may be missing).
- Its voucher/points/membership/affiliate logic is additional business complexity not implemented in the isolated SBX checkout. A production replacement must preserve these behaviors deliberately, with server-side revalidation and atomicity, not silently remove them.
- The web order-sync, cancel, repay and webhook flows also require duplicate/late-event guards; these are **separate** from this read-only PR.

The website and mobile flows must be audited together before enabling live Android checkout. Merely securing `POST /api/orders` does **not** secure the storefront Server Action.

## This PR: what changes, and what does NOT

- Adds `POST /api/checkout/production-preflight` on **staging only**. It is a read-only preparatory audit for the future hardened production checkout, not an actual checkout route.
- **Triple gate:** `APP_ENV=staging`, `CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED=true`, and Xendit key format starting `xnd_development_`. Disabled is **404 before authentication, DB access or provider lookup**. Do not set this flag in `ENV_PROD`. Default is OFF.
- Authenticated request: `{addressId,courierCompany,courierType,courierPrice}` exactly, where courier fields are server-provided codes and price from the current quote preview.
- Reads only customer cart, product/variant eligibility, online default location and inventory balance, including `reserved`; sums duplicate cart lines before stock comparison. Reuses existing `loadTrustedCheckoutSelection` to verify owned destination and fresh Biteship rate. Calculates server-owned estimated subtotal and shipping total and returns `advisoryOnly: true` / `checkoutEnabled: false`.
- **NO order created, NO cart cleared, NO stock deducted or reserved, NO invoice created, NO call to Xendit, NO Biteship booking**. Fresh *rate lookup* calls Biteship for quote only.
- No migration, no payment / webhook changes, no app or web checkout button change, no Docker/production environment changes. Existing customer-facing checkout paths remain untouched.
- A successful preflight is **NOT a reservation or a guarantee** that the same stock, product price or shipping quote will remain available at final commit. A future hardened production route must perform the checks again under one DB transaction and a durable idempotency key.

### Response example (illustrative, not a booked order)

```json
{
  "success": true,
  "data": {
    "mode": "staging_preflight_only",
    "checkoutEnabled": false,
    "checks": { "inventory": "pass", "freshQuote": "pass" },
    "itemCount": 1,
    "subtotal": 35000,
    "shippingCost": 9000,
    "estimatedTotal": 44000,
    "courierCompany": "jne",
    "courierType": "reg",
    "courierName": "JNE",
    "advisoryOnly": true
  }
}
```

## Staging activation and UAT (AFTER CI, review, and merge)

1. Verify on staging that the route returns HTTP 404 while the flag is OFF. No need to create an order.
2. Only if QA approves a controlled read-only UAT, set `CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED=true` **in the existing approved staging secret configuration source** and redeploy staging. `main` deploy rewrites `.env.app` from `ENV_TEST`; GitHub secrets cannot be read back. Never overwrite `ENV_TEST` without having the complete original contents. Do not send secrets to chat or logs. Alternatively add a dedicated staging-only Actions Variable bridge in a separate reviewed PR.
3. Verify `APP_ENV=staging` and the Xendit key is a development-format key *without printing any credential*. The triple gate must remain 404 in production even if the feature flag is mistakenly true.
4. With an authorized disposable staging customer and a valid staging address/cart, call the endpoint with the current courier code and price from `/api/shipping/rates`. Expect 200 and **read-only advisory totals**. Use a different price or courier → 409; foreign address → 404; insufficient online stock → 409; malformed body → 400; no auth → 401.
5. Confirm **no new orders/invoices, stock movements or cart clears** after each attempt. Staging DB checks must be read-only; do not attempt to post a sandbox order during this step.
6. Turn the flag back **OFF** after UAT and verify 404. Preserve all existing staging/production data.

## Release blockers / follow-up implementation order

1. Audit `app/actions/orders.ts` web checkout separately, including voucher, membership, points and pricing; the web UI does not exclusively use the legacy API. Record all writes and dependencies.
2. Extract a *shared* atomic checkout transaction for new checkout attempts, retaining ordered locks, online stock conditional updates, consistent pricing/snapshot and idempotency. Do not replace production `POST /api/orders` in one untested deployment.
3. Implement durable Xendit invoice attempt/reconciliation state: a remote timeout and missing local invoice must never cause blind creation of another remote invoice, and must not be reported as paid/success.
4. Test duplicate Idempotency-Key, concurrent submissions, stale quotes, low stock, Xendit timeout and failed DB writes; repeat PAID/EXPIRED webhook, late callback and refund/cancel regression, voucher and rewards.
5. Review and deploy on staging with sandbox Xendit/Biteship; require explicit owner approval before *any* live flag, Android checkout button, or production route activation.

## Rollback

Disable `CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED` in the **staging source configuration**, then redeploy staging and verify 404. Since this endpoint never mutates state, no order/stock rollback is required. Existing production checkout routes remain unchanged. Do not run `docker compose down -v`.
