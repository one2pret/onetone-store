/**
 * Deliberately staging-only. The production checkout is NOT authorized by
 * this feature flag, even when it is accidentally set to true in ENV_PROD.
 * This route only reads a cart/stock/quote; it never creates an order.
 */
export function productionCheckoutPreflightEnabled(
  flag?: string,
  appEnvironment?: string,
  xenditKey?: string,
): boolean {
  return flag === 'true' &&
    appEnvironment === 'staging' &&
    typeof xenditKey === 'string' &&
    xenditKey.startsWith('xnd_development_');
}
