# Checkout security foundation — 2026-11-04

## Source audit (main)
- app/api/orders/route.ts POST accepts courierPrice directly from request and uses it in shippingCost/total.
- It inserts order, items, shipping, deducts stock and deletes cart through separate operations, without a shared DB transaction.
- It catches Xendit invoice errors and still returns 201 success, possibly without paymentUrl.
- lib/stock.ts uses read-then-write inventory balance updates, which need concurrency-safe reservation/stock checks.

## This PR
- Adds a pure rate selection validator and tests, **not integrated** into live order POST.
- No behavior change to existing web checkout or mobile checkout.
- Passing these unit tests does NOT mean checkout is secure.

## Implementation order
1. Extract a shared server-side shipping quote service from app/api/shipping/rates/route.ts. Recalculate using authenticated user's current cart, owned address, active couriers, configured store origin and Biteship response. Normalize service/company codes; do not trust client courierPrice. Define expiration and rate-failure policy.
2. Refactor order creation to a DB transaction: lock or conditionally update stock and inventory balance, insert order/items/shipping, clear cart and handle rollback. Design Xendit invoice lifecycle with an explicit pending-payment/failed-invoice state, idempotency key, reconciliation and webhook verification. Avoid calling remote Xendit inside a long DB transaction.
3. Add integration tests for tampered price, stale quote, foreign address, zero stock, concurrent orders, repeated requests, Xendit timeout, webhook replay, and failed DB writes.
4. Test against staging database and sandbox Xendit/Biteship. Verify existing web checkout as well as Flutter. Deploy backend separately only after review and explicit release approval.
5. Enable mobile order button behind a controlled release flag only after all above gates pass.

## Customer beta
A non-transactional beta may offer registration, login, catalog, cart, address management, GPS and shipping estimate. Label checkout as unavailable. Production registration still needs abuse protection, privacy/terms and account recovery review.

## Agent handoff
Do not represent this foundation PR as a security fix to production. Do not merge/deploy live order changes without web regression tests, CI green and staging UAT.
