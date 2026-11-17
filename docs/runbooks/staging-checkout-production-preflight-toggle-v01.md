# OneTone — Staging checkout preflight flag (read-only v0.1)

**Status:** Awaiting code review. Applies only to `one2pret/onetone-store` testing/staging, not production.

## Why

The read-only route `POST /api/checkout/production-preflight` was merged in PR #80 and staging deployment completed. The endpoint remains **OFF** by default. This workflow change adds one independent staging-only GitHub Actions **Repository Variable**, avoiding overwriting the multiline `ENV_TEST` secret when an authorized operator wants a focused UAT.

The preflight checks customer-owned cart/address, server product/variant eligibility, online inventory balance after reservations and a fresh Biteship shipping quote. It does **NOT** create an order, reserve/deduct stock, clear cart, create Xendit invoices or book Biteship shipments. It is not a live checkout switch.

## Source-of-truth config

- GitHub Actions variable (not secret): `CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED_TEST` with `true` or `false`.
- Testing deployment appends **exactly one** `CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED` to `.env.app`, removing any older line from `ENV_TEST`.
- `APP_ENV=staging` and a `xnd_development_` Xendit key are **also** required in the server route; an incorrect app environment or LIVE key causes HTTP 404 even when the variable says true.
- Production deployment branch/job is **unmodified** and never receives this variable. Do not alter `ENV_PROD` for this test.
- Existing Biteship TEST booking remains OFF, regardless of this flag.
- Main branch automatic deployment overwrites staging `.env.app` from `ENV_TEST` and the variables each time. A GitHub variable change alone does **not** change a running container.

## First check: read-only route OFF after merge

From a trusted terminal, check the publicly accessible endpoint *without signing in*:

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' \
  -X POST 'https://onetone.kanuraga.web.id/api/checkout/production-preflight' \
  -H 'Content-Type: application/json' -d '{}'
```

Expected **HTTP 404** while disabled. A 404 alone does not prove a specific configuration state; check runtime as needed.

## Controlled staging UAT (explicit operator decision)

1. CI PASS, review, merge only to `main`. Confirm staging deploy passed.
2. In GitHub → Settings → Secrets and variables → Actions → **Variables**, create/update `CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED_TEST=true`. This is a nonsecret switch, **not** an API key.
3. In GitHub → Actions → **Build & Deploy onetone-store** → **Run workflow**, select branch `main` and check `staging_only_confirm=true`. The workflow has a manual dispatch guard; manual execution is strictly `main` → build + **staging only**, never production. The normal `production` push workflow remains unchanged. Do not manually run or rerun production jobs for this UAT.
4. Verify `APP_ENV=staging` and preflight flag enabled in the **running** app container without printing any keys:

```bash
docker exec onetone-app sh -c '
  echo "APP_ENV=${APP_ENV:-NOT_SET}"
  echo "PREFLIGHT_FLAG=${CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED:-NOT_SET}"
  echo "SANDBOX_BOOKING_FLAG=${BITESHIP_SANDBOX_BOOKING_ENABLED:-NOT_SET}"
'
```

5. Anonymous POST should now yield 401 (if the route is enabled). Use a **disposable staging** customer Bearer token privately in your own API client (never paste credentials into ChatGPT or logs), with an owned address, cart, and matching active courier/price from `POST /api/shipping/rates`. The request is:

```json
{
  "addressId": 123,
  "courierCompany": "jne",
  "courierType": "reg",
  "courierPrice": 9000
}
```

This is **illustrative**; never assume 123/9000 are the user's actual current address/rate. Expected 200 with `advisoryOnly=true`, `checkoutEnabled=false` and `estimatedTotal`; same request with a wrong price should be rejected (409). Foreign address should be 404. Out-of-stock product should be 409. The tests do not create any order.

6. Compare **read-only** database counts for orders, invoices, stock movements, cart quantities and online stock before/after. Do not test production customer data. A successful response is advisory, not a reservation; it can become stale at any time.

## Turn OFF immediately after UAT

1. Set `CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED_TEST=false` in GitHub Actions Variables.
2. Go to Actions → **Build & Deploy onetone-store** → **Run workflow**, branch `main`, `staging_only_confirm=true`. This explicitly redeploys staging with the updated OFF variable. Do not click old production jobs.
3. Verify in the runtime that flag is false and unauthenticated endpoint again responds HTTP 404.
4. Do not alter `ENV_PROD`; do not delete staging orders/invoices; do not use `docker compose down -v`.

## Critical next work

Preflight does not secure the legacy `POST /api/orders` or `app/actions/orders.ts` web checkout; these still require a shared transactional commit, durable idempotency, provider uncertainty reconciliation, and duplicate/late PAID/EXPIRED webhook hardening. Android production checkout stays disabled. See issue #79 and `docs/checkout-production-preflight-v01.md`.
