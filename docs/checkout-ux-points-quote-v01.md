# Checkout wizard safety + visual clarity v0.1

Date: 21 November 2026. Branch-only UI improvement; no production activation.

## Changes

- Point redemption preview applies only complete Rp100 point units, **never rounds point consumption upward** and keeps at least Rp1 payable. This removes an existing preview problem when the payable amount is not evenly divisible by Rp100. The server remains the authority.
- Voucher policy that forbids stacking now disables the point switch and shows a clear message. Previously the switch could still appear available.
- When the customer changes address, the selected courier and quote are invalidated, and late responses from an earlier address are ignored. New address needs a new quote and selection.
- Payment review now shows a visually separated, accessible final-total panel, with a reminder that price and inventory must still be checked by backend. A zero-value checkout preview cannot be submitted.
- Unit tests cover point rounding and amount boundaries. Component tests cover the exact points displayed and courier selection invalidation. CI typecheck + unit test suite applies.

## Scope and limitations

- Client-side preview validation is **not** server-side checkout hardening. Existing `app/actions/orders.ts` and `POST /api/orders` still require migration to a server-trusted, idempotent, transactional checkout and Xendit ledger.
- Displayed rates are estimates. Server must re-quote a trusted courier selection at commit and enforce expiration/price-change policy; this PR does not change that server behavior.
- No backend mutation, checkout API change, payment/booking provider request, schema migration, feature flag or deployment action.
- Separate manual responsive/visual UAT for Android Chrome and mobile viewport remains necessary; automated component tests are not screenshot review.

## Release sequence

Review UI behavior in staging after merging, then complete benefits/voucher/affiliate transaction parity, shared web+mobile checkout API, payment reconciliation, and production release gates in Issue #79. Do not merge `main` wholesale into `production` until release audit is done.
