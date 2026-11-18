/**
 * Compatibility facade for the existing staging-only Sandbox Checkout route.
 * The implementation moved unchanged to commit-online-order.ts so the
 * legacy production API and storefront Server Action remain untouched.
 *
 * DO NOT enable this for production until voucher/points/affiliate business
 * rules, invoice idempotency and live shipping UAT have passed.
 */
export {
  commitOnlineOrderAtomically as commitSandboxOrder,
  CheckoutRejected,
} from './commit-online-order';
export type { CommittedOrder } from './commit-online-order';
