#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

node - <<'JS'
const value = process.env.SANDBOX_BOOKING_TEST_DATABASE_URL;
let url;
try { url = new URL(value); } catch { process.exitCode = 2; }
if (!url || url.protocol !== 'mysql:' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/sbx_booking_test') {
  console.error('Set SANDBOX_BOOKING_TEST_DATABASE_URL to disposable local MySQL with /sbx_booking_test.');
  process.exit(2);
}
JS

npm run test:run -- tests/integration/checkout-voucher.test.ts \
  tests/integration/sandbox-payment-ledger-runtime.test.ts \
  tests/integration/sandbox-webhook-ledger-sync.test.ts \
  tests/integration/checkout-payment-attempts.test.ts tests/integration/sandbox-booking.test.ts \
  tests/integration/checkout-membership-points.test.ts tests/api/order-actions.test.ts \
  tests/api/webhooks-xendit.test.ts lib/checkout/sandbox-xendit-webhook.test.ts \
  lib/checkout/sandbox-order-policy.test.ts --maxWorkers=4
