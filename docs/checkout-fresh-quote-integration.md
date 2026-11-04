# Fresh server-side checkout quote — integration gate

## Current PR
- Adds `loadFreshCheckoutRates(userId, addressId)` and `loadTrustedCheckoutSelection(...)`.
- Reads an owned address, store origin, active couriers, current cart, product weights and current prices from the server.
- Rejects missing/zero weights and invalid coordinates before calling Biteship.
- Matches selected courier/service/price against a newly requested Biteship quote.
- **Not wired to /api/orders or /api/shipping/rates**. No runtime checkout behavior changes.

## Required verification before wiring
1. CI TypeScript check and unit tests; do not merge red.
2. Audit actual staging product weights, including zero and variant items.
3. Verify Biteship weight/quantity semantics with a real staging quote for quantity 1 and 2. Current implementation intentionally preserves the existing calculation, not a new assumption.
4. Refactor order creation to an atomic DB transaction and safe stock deduction, then implement invoice failure state and idempotency. Do not use an external HTTP call inside a long transaction.
5. Regression test web checkout, Android checkout, and sandbox Xendit end to end.
6. Promotion to production requires explicit approval after staging UAT.

## Release boundary
Main auto-deploys to staging. This PR only adds an unused server helper, so no live order behavior is expected to change. Keep mobile checkout disabled until all transaction/payment gates pass.
