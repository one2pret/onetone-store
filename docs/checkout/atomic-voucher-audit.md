# Atomic voucher checkout audit

Status: PARTIAL / BLOCKED for endpoint use. A restricted opt-in grant flow is implemented in the shared kernel. No endpoint is wired to voucher handling by this work.

`user_vouchers` has a unique user/campaign grant and available/reserved/redeemed states. Legacy online checkout reserves grants, but public vouchers have no universal per-user reservation ledger. `used_count` is incremented after payment in the legacy Xendit webhook, in a different transaction from grant redemption and order status updates. POS updates quota in its own transaction. A kernel-only count of reserved grants cannot guarantee global quota against legacy checkout and webhook concurrency. First-order eligibility currently checks completed orders after grant creation, without a shared lock protocol across POS and online flows. `max_uses_per_user` lacks a universally enforced usage ledger. Expiry, cancellation, and reconciliation must be considered together with quota release and idempotent redemption.

A restricted grant-only, unlimited-quota path still requires a transactional expiry, ownership and lifecycle design, plus integration tests proving its interaction with existing writers. Before enabling any voucher path, establish and test one shared reservation/redemption protocol across all writers, including old pending orders and callbacks. Until then do not introduce an opt-in path that can affect actual orders.

Required next tests include real MySQL races between online and POS/legacy writers, voucher quota and grant ownership, first-order contention, allow-points stacking, inventory failure rollback, expiry/cancellation release and duplicate webhook handling. No staging or production database or provider access is needed for those tests.

## Voucher opt-in v0.1

The shared kernel accepts `benefits: { kind: 'voucher-membership-v1', voucherId, pointsToRedeem }` only from an explicit future caller. It locks the voucher and owned grant, calculates the discount from database values and reserves the grant in the order transaction. Stock, cart, points and reservation roll back with the transaction. Existing sandbox and membership-points-v1 calls do not opt in. The server must still provide a trusted shipping quote and cart snapshot.

Only active, unarchived `new_user` grants with unlimited quota, no store restriction, `maxUsesPerUser=1` and `firstOrderOnly=false` are supported. Time windows, minimum spend, tier, ownership, grant expiry and `allowPoints` are checked. All other policies fail closed. Existing first-order and quota semantics are intentionally not approximated.

**BLOCKED for endpoint use:** sandbox payment callbacks do not implement grant redemption or release for this new path, and legacy callback processing is not atomic with all order effects. Complete the payment, expiry and cancellation lifecycle with idempotent reservation recovery and full kernel integration and concurrent stock/points tests before connecting any route. Current MySQL tests exercise the reservation helper and rollback, not the complete checkout transaction.
