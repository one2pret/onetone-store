# Staging UAT: shipping preview and checkout quote parity

**Scope:** Kanuraga staging, web and Android testing build only. No production promotion.

## Why this change
Biteship Rates API expects `items[].weight` in grams **per unit**, `items[].value` per unit, and `items[].quantity` separately. Previous code multiplied weight and value by quantity before sending quantity as well, potentially double-counting. Source: https://biteship.com/id/docs/api/rates/retrieve

The web/mobile preview (`POST /api/shipping/rates`) and gated validation (`POST /api/checkout/validate-quote`) now share `loadFreshCheckoutRates`, including owned address, cart contents, active couriers and product weights. Preview response remains `{success:true,data:{express:[],regular:[],economy:[]}}`.

## CI gate
- Run `npm run test:run`, `npx tsc --noEmit`, and `npm run lint` (or repo CI equivalent) before merge.
- Do not claim CI passed before results are available.

## Tests on staging
1. Confirm GH Actions deploy `main` succeeded and server flag `CHECKOUT_QUOTE_VALIDATION_ENABLED=true` is still available; workflow rewrites `.env.app` from `ENV_TEST` on deploy.
2. With a test account, verify checkout cart contains one product with confirmed 200 gram master weight. Select an owned address with valid nonzero coordinates. Open courier options from Android and from web. Confirm prices are returned and displayed without response parsing errors.
3. Change quantity from **1 to 2**, request fresh quotes, and verify both succeed. Verify Biteship request semantics in tests: `weight=200`, `value=unit price`, `quantity=1 or 2`; the **shipping rate itself is not expected to be linear**.
4. Select any returned rate using its `courier_code`, `courier_service_code`, and `price`; call authenticated `POST /api/checkout/validate-quote` with `{addressId,courierCompany,courierType,courierPrice}`. Expect **200** if rate unchanged.
5. Tamper price (e.g. set to 1) and verify **409**, with no order created.
6. Test a cart with missing/zero weight or invalid destination coordinates using disposable staging test data, and verify **422**. Do not modify real merchant catalog simply for a test.
7. Verify web checkout still handles the same grouped rate response; new errors use clear messages, with `404` foreign address, `400` empty cart and `503` provider/config failure.
8. Record screenshots/HTTP status (no auth token, secret, customer private data) and CI results.

## Rollback
If staging web/mobile shipping preview regresses, revert this PR on `main` through normal GitHub review workflow. Do not hotfix production or run `docker compose down -v`; note the automatic deployment will rewrite `.env.app` from `ENV_TEST` again.

## Explicit non-goals
- This PR does **not** harden `POST /api/orders`, add transaction/stock locking, create Xendit invoices, or enable Flutter “Buat Pesanan”.
- Shipping parity is a prerequisite for the **next** PR to harden checkout end-to-end, not a launch authorization.
