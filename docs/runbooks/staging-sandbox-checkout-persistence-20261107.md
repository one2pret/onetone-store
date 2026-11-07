# Runbook — Persistent staging sandbox checkout gate

Date: 2026-11-07. Environment: **Kanuraga staging only**.

## Symptom

The Android testing APK displays **"Buat Pesanan — TESTING"**, but pressing it shows **"Not available"**. This exact error is emitted by `POST /api/checkout/sandbox-order` when either:
- `CHECKOUT_SANDBOX_ORDER_ENABLED` is not exactly `true`; or
- `XENDIT_SECRET_KEY` does **not** start with `xnd_development_`.

In this situation the route rejects before any order, inventory mutation or Xendit invoice. No stock decrement is expected. A successful Biteship quote does not prove sandbox order is enabled.

`main` deployment currently recreates `/opt/onetone-store/.env.app` from GitHub Actions secret `ENV_TEST`, overwriting ad-hoc VPS changes.

## Quick read-only check on VPS

Do not paste secrets or whole `.env.app` into chat/logs.

```bash
docker exec onetone-app sh -c '
if [ "$CHECKOUT_SANDBOX_ORDER_ENABLED" = "true" ]; then
  echo "SANDBOX_ORDER=ENABLED"
else
  echo "SANDBOX_ORDER=DISABLED"
fi
case "$XENDIT_SECRET_KEY" in
  xnd_development_*) echo "XENDIT_MODE=TEST" ;;
  *) echo "XENDIT_MODE=OTHER_OR_MISSING" ;;
esac
if [ -n "$XENDIT_WEBHOOK_TOKEN" ]; then
  echo "WEBHOOK_TOKEN=SET"
else
  echo "WEBHOOK_TOKEN=MISSING"
fi
'
```

To check HTTP status without modifying data:

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' \
  -X POST https://onetone.kanuraga.web.id/api/checkout/sandbox-order \
  -H 'Content-Type: application/json' -d '{}'
```

While enabled and Xendit in development mode, an anonymous request should return **401** (requires a customer token). **404** with body `Not available` indicates the safety gate is closed. No test order is created by this check.

## Permanent fix: staging-only GitHub Actions Variable

**Before merging this PR**, open:

`one2pret/onetone-store` → **Settings → Secrets and variables → Actions → Variables** → **New repository variable**.

Set exact name and value:

```text
Name:  CHECKOUT_SANDBOX_ORDER_ENABLED_TEST
Value: true
```

This variable is **not a secret** (it is a feature flag). Do not modify `ENV_TEST` or `ENV_PROD`; GitHub cannot display their current values. `ENV_TEST` continues to contain app secrets unchanged.

Staging deploy reads the Actions variable via the SSH step `envs` input, safely deletes a duplicate `CHECKOUT_SANDBOX_ORDER_ENABLED=` assignment from generated `.env.app`, then appends exactly one line:
- Variable `true` → `CHECKOUT_SANDBOX_ORDER_ENABLED=true`.
- Absent/false/anything else → `CHECKOUT_SANDBOX_ORDER_ENABLED=false` (fail closed).

This step is **only in `deploy-testing`**, and production deployment remains unmodified. It does not change Xendit keys, webhook tokens, database, Docker volumes, or mobile APK. It only persists the staging feature flag through subsequent `main` deployments.

After setting the variable, review and merge this PR to `main`. Verify GitHub **Build & Deploy onetone-store** run succeeded, then run the read-only VPS/HTTP checks above again. If you forgot to create the variable before merge, the deployment defaults to DISABLED; create the variable, then run a new staging deployment according to approved CI procedures. **Do not change production branch.**

## Retry checkout safely

Once flag enabled, Xendit development credentials verified and Test Mode Invoice callback URL/token verified:

1. Use disposable staging user, staging warehouse stock, valid product gram weight and GPS address; avoid using expensive dummy catalogue items or real customer data.
2. Open the **existing installed testing APK**. A new APK build is **not required** just because the backend flag was corrected.
3. Refresh the shipping quote, select a Biteship option and submit once.
4. Expect an order number and TEST-mode invoice URL; verify order, inventory and cart in staging.
5. On a network timeout or `202 payment_setup_pending`, do not reset idempotency UUID or create another new order. Reconcile the previous attempt with Xendit.
6. If the next error reports weight, location, insufficient stock or changed courier rate, investigate that separately: the initial `Not available` was an earlier gate.

## Safety/rollback

- To disable test orders: set `CHECKOUT_SANDBOX_ORDER_ENABLED_TEST=false` in GitHub Actions Variables; deploy staging normally and verify 404 from the anonymous sandbox order endpoint.
- Existing sandbox invoices/orders are **not** cancelled or resolved by disabling the gate; reconcile them before ignoring callbacks.
- A staged callback may be retried by Xendit when the gate is off. Keep the configured Test Mode Invoice callback URL `https://onetone.kanuraga.web.id/api/webhooks/xendit`, and never modify the Live Mode webhook for this test.
- No database migrations or destructive Docker commands are needed.
