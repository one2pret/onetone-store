# OneTone checkout — optional membership points atomic bridge v0.1

Status: **Draft PR, no live checkout activation**. Date: 21 November 2026. This change follows financial totals contract PR #88.

## Why

The legacy web Server Action currently reserves vouchers and adjusts membership points separately from order items, shipping, stock deduction and cart deletion. The first shared atomic kernel supports order/items/shipping/stock/cart but not web membership benefits. Prior pure contract `calculateCheckoutBusinessTotals()` now enforces valid Rupiah values, voucher and points rules.

## What changed

1. `lib/checkout/transactional-membership-points.ts` loads membership and tier threshold using a MySQL row lock in **the caller's existing transaction** and performs a conditional non-negative points decrement plus `points_ledger` insert. No nested DB transaction.
2. `commitOnlineOrderAtomically` now takes an **OPTIONAL** explicit `benefits: { kind: 'membership-points-v1', pointsToRedeem: number }`. Without this input, the current TEST sandbox route is unchanged: no membership query, no free shipping, no points debit, no provider change.
3. With this option only, the kernel reads server-owned member/tier data, calls the PR #88 pure calculator, persists the adjusted `orders.shipping_cost`, `orders.points_redeemed`, and `orders.total`, and debits exact points inside the same transaction as order/item/stock/cart. `shippings.price` remains the trusted actual carrier quote (merchant bears any waived fee). Unsupported voucher/affiliate fields are rejected, never ignored.
4. Added isolated MySQL 8 tests for member lock, exact debit + ledger, rollback, unique redemption ledger, concurrent insufficient points, zero-point no-op and malformed debit. CI uses the existing local disposable MySQL service; no staging or production database.
5. No migration, new checkout API, updated Xendit/Biteship integration, changed env/feature flag, production branch push or UI activation.

## Important boundaries / remaining production blockers

- Voucher eligibility, quota and one-time reservation, `maxUsesPerUser`, first-order requirements, and affiliate attribution/commission are NOT implemented in this optional path. Their omission must block promotion of a full web checkout migration; do not skip them.
- A new caller MUST obtain trusted shipping selection with server-owned cart/address/weight/rates and provide a fresh checkout snapshot. Never trust client-calculated totals or membership points.
- Idempotency currently checks order number; the future provider-backed production flow must enforce request fingerprint and durable payment-attempt recovery. Web and Android MUST share one service and Xendit callbacks must reconcile the ledger, and EXPIRED must restore redeemed points exactly once.
- Membership tier benefits may change between read-only shipping preview and locked checkout. A changed total should be presented to customer and reconciled; do not charge unexpectedly.
- Full checkout UAT requires actual existing shared kernel commit tests, concurrent order/stock/funds rollback tests, voucher/affiliate parity, Xendit TEST and Biteship TEST provider workflow and human release approval.
- Branch `production` remains divergent from `main` and must not receive a bulk merge without a reviewed release diff, database migrations, backups and rollback.

## Verification

GitHub Actions PR typecheck, Vitest (includes pure contract), and isolated MySQL tests:

```sh
npx tsc --noEmit
npm run test:run
SANDBOX_BOOKING_TEST_DATABASE_URL=mysql://root@127.0.0.1:3306/sbx_booking_test \
 npx vitest run tests/integration/checkout-membership-points.test.ts
```

The local MySQL command must target a dedicated test service only, never production or a shared staging database. The test creates and drops a uniquely named database. No `db:push` is required.

Rollback: revert the optional helper, kernel argument branch, tests and CI addition; no data migration. Existing sandbox callers continue to omit `benefits`.
