# Xendit Test Mode: one Invoice callback URL for web + Android sandbox

## Objective

Xendit Test Mode currently has ONE configured **Invoices paid** callback URL:

```text
https://onetone.kanuraga.web.id/api/webhooks/xendit
```

**Keep this URL unchanged.** The shared route automatically handles:

| Invoice `external_id` | Handler | Safety |
|---|---|---|
| `SBX-<36 hex>` | Sandbox atomic handler | Checks test-mode flag, Xendit callback token, stored invoice ID, order number, amount and transactional state |
| Standard website order | Existing legacy handler | Preserves behavior of web orders while the website checkout hardening is pending |

The existing optional `/api/checkout/sandbox-xendit-webhook` remains for compatibility; **do not configure both endpoints as separate duplicate webhook destinations**.

## Preconditions

1. Verify this PR has passed TypeScript/unit tests and is merged to `main`. Confirm the **Kanuraga staging** deployment succeeds. Do not merge to `production`.
2. Use Xendit **Test Mode**, not Live Mode. Verify `XENDIT_SECRET_KEY` in the staging container starts with `xnd_development_`; do not print its value.
3. Confirm `XENDIT_WEBHOOK_TOKEN` is set **and equals the Xendit test-mode callback token**. A mere `SET` printout does NOT prove the tokens match.
4. Ensure `CHECKOUT_SANDBOX_ORDER_ENABLED=true` only on Kanuraga staging. A disabled flag causes SBX callbacks on the shared URL to return **503** (requesting retry), not to fall into legacy stock handling.
5. Under **Invoices paid** in the test-mode dashboard, retain the "also notify expired invoices" option. The project uses legacy Xendit Invoice callbacks, not `payment.capture`.
6. The GitHub staging deploy rewrites `/opt/onetone-store/.env.app` from secret `ENV_TEST`. Manual host changes may be lost on every main deployment. If you have the complete approved copy, update `ENV_TEST` safely; **never overwrite a secret without preserving all current entries**.

## Safe checks without any payment

After deployment, on the Kanuraga VPS:

```bash
docker exec onetone-app sh -c '
if [ "$CHECKOUT_SANDBOX_ORDER_ENABLED" = true ]; then echo "SANDBOX_ORDER=ENABLED"; else echo "SANDBOX_ORDER=DISABLED"; fi
case "$XENDIT_SECRET_KEY" in
  xnd_development_*) echo "XENDIT_MODE=TEST" ;;
  *) echo "XENDIT_MODE=UNKNOWN_OR_LIVE" ;;
esac
if [ -n "$XENDIT_WEBHOOK_TOKEN" ]; then echo "WEBHOOK_TOKEN=SET"; else echo "WEBHOOK_TOKEN=MISSING"; fi
'
```

Anonymous requests to `POST /api/checkout/sandbox-order` should return **401** while gated endpoint is enabled. Do not expose customer authentication tokens.

`POST /api/webhooks/xendit` with a missing/invalid callback token must return **401**. A 401 here **does not mean that Xendit has the correct token**; check the actual callback delivery logs in the provider dashboard.

## Integration UAT (after a staging DB backup)

1. Use disposable staging account and test product with valid nonzero gram weight, coordinates, available variant/product stock **and** online warehouse balance.
2. In a signed Android TEST build, select address and Biteship courier; use explicit `enable_sandbox_checkout=true` only after verifying the new routing is deployed.
3. Submit one order and check it returns 201 with one SBX order number and test invoice URL. Confirm only one order, invoice, sale movement and stock decrement; retry with same Idempotency-Key.
4. In Xendit Test Mode, complete the payment. Confirm the shared URL received an authorized PAID event and the sandbox invoice/order transitions to `paid`/`packing` exactly once.
5. Replay PAID (via approved test facility) and confirm it does not duplicate status history or stock changes.
6. Create a separate disposable order and test EXPIRED; inventory is restored to the original location exactly once, with repeat EXPIRED a no-op.
7. Send EXPIRED after PAID, or PAID after EXPIRED in controlled test and confirm response `manual_reconciliation_required`, without silently rewriting stock.
8. Regression test the website's existing Test Mode checkout callback to confirm it **still** uses the legacy path. **Do not assume this legacy flow is production-secure**; it needs separate hardening.
9. Inspect provider webhook logs and backend logs. Never copy raw callback tokens or customer PII into issues or PRs.

## Expected responses

- Missing/wrong callback token: **401**.
- Valid SBX callback with invalid shape or mismatched fields: **422/409**, no order mutation.
- SBX callback before invoice is saved locally: **503**, allow provider retry.
- Valid sandbox PAID or EXPIRED: **200**.
- Duplicate sandbox callback: **200**, no duplicate mutation.
- Conflicting terminal sandbox callback: **200** with `manual_reconciliation_required` and logged operator review.
- Sandbox flag disabled on the shared URL: **503**, never fall through to legacy.
- Legacy website callback: existing behavior unchanged.

## Rollback

If the router causes a staging regression, disable `CHECKOUT_SANDBOX_ORDER_ENABLED` to prevent new sandbox order creation and revert this PR through GitHub review. **Disabling the flag may cause Xendit retries for already-created sandbox invoices.** Reconcile existing sandbox orders before leaving this condition unresolved. Do not change Xendit Live Mode callbacks or delete database volumes.

## Open launch blockers

Production rollout remains blocked by legacy website order endpoint security, complete end-to-end sandbox payment UAT and manual reconciliation design for ambiguous Xendit invoice-creation errors. Passing a unit test is not the same as a real paid/expired sandbox invoice callback.
