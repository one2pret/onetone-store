# Shared Checkout Financial Parity Contract v0.1

Date: 21 November 2026
Scope: **code + pure regression tests only**; NOT a live checkout migration, provider UAT, or deployment.

## Verified baseline

- The staging SBX route uses `commitOnlineOrderAtomically` (alias `commitSandboxOrder`) to commit order/items/shipping/online stock/cart under MySQL locks.
- The production web Server Action `app/actions/orders.ts:createOrder` separately applies voucher, tier free shipping, redeemed points, and affiliate attribution. It writes order + points/grant reservation in one transaction but writes affiliate click, items, shipping, stock and cart outside that transaction.
- The legacy Android-facing `POST /api/orders` trusts courierPrice, writes several entities outside one transaction, and can respond 201 if `createInvoice` fails. **Do not turn on live Android checkout or assume this route is safe**.
- The shared kernel intentionally does **not** implement voucher, membership, points or affiliate effects today.

## This milestone: pure business totals

`lib/checkout/business-totals.ts` defines `calculateCheckoutBusinessTotals`.

Its inputs must be gathered and validated on the server, not copied from client price or voucher discount fields:

- Server-priced subtotal of locked current cart.
- Fresh server-selected Biteship quote in Rupiah (before optional free shipping).
- Owned, valid voucher eligibility, discount and allowPoints policy.
- Current membership's free shipping threshold and point balance.
- Requested redemption quantity (integer points, checked against member balance).

The output records subtotal, voucher discount, free shipping decision, final shipping cost, points used and their monetary deduction, and final total. The order of operations matches the web checkout: **subtotal → voucher discount → shipping/tier → points redemption → invoice total**. Existing `membership-utils` functions are reused.

The future shared atomic kernel must revalidate the relevant identities, amounts, voucher and membership state under transaction locks, reserve the one-time voucher conditionally, debit points conditionally and create one `points_ledger` entry. Affiliate attribution, click conversion and commission lifecycle require their own transaction design. This pure module does NOT reserve inventory or payment attempts, and should not be called with untrusted values.

## Deliberate fail-closed differences from the legacy action

1. Reject fractional, negative, non-safe-integer or over-subtotal amounts.
2. Reject point redemption without an existing member balance or if points are insufficient.
3. Reject stacking points with a voucher that disallows stacking.
4. Reject requesting more points than can be applied as Rupiah (legacy `calculateRedeemAmount` caps the monetary reduction but the legacy checkout may still debit every requested point).
5. Reject zero-Rupiah final total; Xendit live invoices must not be assumed to accept zero. UI must prevent over-redemption or show clear reselect guidance.
6. Reject sums outside safe integer bounds before persistence.

These stricter results are **not automatically imposed on legacy production checkout in this PR**. They are target behavior for the upcoming reviewed web/API migration, including matching UI hints and end-to-end test expectations.

## Verification

```sh
npx tsc --noEmit
npx vitest run lib/checkout/business-totals.test.ts
npm run test:run
```

The PR GitHub Actions pipeline also runs existing isolated MySQL integration tests, but this particular module is pure and has no database/provider IO. It does not claim concurrency, rollback, payment provider, or physical Android UAT.

## No-go / follow-up

1. Implement transaction-bound benefit validation and reservation for vouchers, membership/points, and affiliate attribution, with disposable MySQL concurrency + rollback tests.
2. Integrate the shared calculator and benefits into the atomic kernel behind a staging-only reviewed path; preserve existing SBX no-benefit behavior.
3. Migrate web Server Action and Android API paths to the same idempotent server-owned checkout service with a durable payment attempt ledger.
4. Add signed Xendit TEST and Biteship TEST end-to-end staging UAT, then owner-controlled production go/no-go under Issue #79.
5. Before any production branch promotion, inspect the significant `production`/ `main` divergence and migration/rollback plan. Never auto-enable live payment or shipping.

No schema migrations, env/flag changes, provider calls, or customer PII are in this PR. Rollback: revert the new source/test/doc files; no data migration is involved.
