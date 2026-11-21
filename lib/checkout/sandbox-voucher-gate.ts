import { sandboxOrderEnabled } from './sandbox-order-policy';

export function sandboxVoucherEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.APP_ENV === 'staging' &&
    env.CHECKOUT_SANDBOX_VOUCHER_ENABLED === 'true' &&
    env.CHECKOUT_SANDBOX_PAYMENT_LEDGER_ENABLED === 'true' &&
    sandboxOrderEnabled(env.CHECKOUT_SANDBOX_ORDER_ENABLED, env.XENDIT_SECRET_KEY);
}

export function sandboxVoucherRatesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^biteship_test\.[A-Za-z0-9._-]+$/.test(env.BITSHIP_API_KEY ?? '') &&
    (!env.BITSHIP_API_URL || env.BITSHIP_API_URL === 'https://api.biteship.com');
}
