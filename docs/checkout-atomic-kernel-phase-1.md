# Checkout Atomic Kernel — Phase 1 extraction (staging only)

**Status:** Draft PR, no production checkout activation.

## Intent

The production owner wants OneTone Store and OneTone Android to support eventual safe live orders. PR #80 already added a *read-only* staging checkout preflight, and PR #81 added controlled testing flag deployment. The next foundation is to avoid maintaining two unrelated inventory+order commit implementations.

The existing staging sandbox checkout `commitSandboxOrder` was already atomic for: account lock, owned address/cart validation, server-owned price+cart snapshot, product/variant checks, order/items/shipping creation, online inventory conditional deduction, stock movements, and cart clearing. No provider call occurs inside the DB transaction.

## Change in this PR

- Move the **unchanged** atomic implementation to `lib/checkout/commit-online-order.ts` as `commitOnlineOrderAtomically`.
- `lib/checkout/commit-sandbox-order.ts` becomes a compatibility re-export so the current staging-only route keeps importing exactly `commitSandboxOrder`, with identical function/class identity and no request/response changes.
- Add regression tests for compatibility. Existing CI unit/API/integration suites must stay green.
- **No new production route or flag.** `app/api/orders/route.ts` and `app/actions/orders.ts` stay unchanged. No migration, no invoice/live Biteship call, no production package change.

## Limitations — do not use live yet

This kernel does not model the existing production storefront's voucher redemption, points balance deduction/earning, membership pricing, affiliate clicks, discount allocation, cancellation/repay or refunds. None of these financial/business operations should be silently dropped when the eventual hardened checkout replaces the legacy paths.

The current staging sandbox handler creates a Xendit TEST invoice *after* commit and returns 202 if invoice outcome is ambiguous. Production readiness still requires durable invoice request attempt state, one payment idempotency key, reconciliation for remote timeouts and DB failures, and exactly-once webhook/stocks lifecycle tests.

The successful `checkout preflight` is advisory and not a reservation. Checkout commit must still re-evaluate stock, prices, address and courier selection under a consistent transaction boundary. In the current staging route, quote validation occurs before DB commit and the cart/address/price snapshot is rechecked inside commit; the courier rate itself can change after quote retrieval. The future production service must formalize quote expiry and any acceptable price tolerance.

## Next implementation PRs (separate, reviewed)

1. Map all production checkout business effects for API + web Server Action: voucher, points, membership, affiliates, address and delivery. Decide whether both paths call the *same* new core commit service.
2. Add durable checkout attempts and payment setup/outcome tables with versioned migrations (staging only initially), unique user+idempotency key, request hash and explicit `needs_reconciliation` states.
3. Implement route under staging-only feature gate and TEST Xendit. Compare invoice identity, prevent duplicate external calls on retry, and maintain exactly-once stock/order semantics under concurrency.
4. Add error and timeout injection integration tests plus webhook PAID/EXPIRED, cancel/repay, refund and stock restore regression tests.
5. Only after end-to-end staging UAT and owner approval, plan a separate controlled production release. Android checkout button remains OFF until then.

## Test gates

- TypeScript check, full vitest, DB integration suite PASS.
- Verify staging /api/checkout/sandbox-order still uses its original input schema, Xendit TEST isolation, and idempotent retry behavior.
- Verify staging /api/checkout/production-preflight default OFF and production branch untouched.
- Human QA review of the moved diff to ensure only identifier/export/comment refactor, no business logic drift.

## Rollback

Revert this PR if tests or staging regression fail. Since schema and deployed order logic are unchanged, no DB rollback is required. **Do not** use `docker compose down -v` or delete sandbox audit records.
