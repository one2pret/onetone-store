# UAT — Android Xendit TEST Browser Return & Separate Login Sessions

**Date:** 11 November 2026  
**Scope:** Staging Kanuraga only — `one2pret/onetone-store`  
**Status:** Fix candidate, not yet merged or deployed. Prior paid order remains valid.

## What happened

During Android checkout UAT, the user created an SBX test order while signed in as a **customer inside OneTone Mobile**. The app opened Xendit hosted **Test Mode** payment in Chrome. After payment, Xendit automatically redirected Chrome to `/orders/<database-id>` on the Kanuraga website. Chrome was **already signed in as a different user with Admin privileges**, and displayed that customer order with status `packing`.

This does **not** show that Android credentials were replaced or the payment was assigned to the wrong customer. App authentication uses its own Bearer token and the browser has independent cookies. The backend's API `GET /api/orders/[id]` verifies ownership except for admin. The website `getOrder` also enforces owner-or-admin access after PR #67. An admin seeing a customer order is allowed under the current permission model.

**Problem:** the *browser return experience* is confusing and unnecessarily surfaces customer order information in a separate session. Someone signed into Chrome as another non-admin customer would instead be denied/not found. Xendit's return URL **must never be treated as payment authentication or proof of PAID**.

## Root cause confirmed in source

- `lib/xendit.ts`: default `successRedirectUrl` and `failureRedirectUrl` go to `/orders/{orderId}`.
- `app/api/checkout/sandbox-order/route.ts`: previously passed the ID and relied on those defaults.
- `lib/presentation/checkout/sandbox_order_status_page.dart` in mobile: **Perbarui Status Pesanan** only fetches `GET /api/orders/{id}` with the authenticated app token. It does not open Chrome. The Xendit hosted page is doing the browser redirect.

## Safe change

For **new sandbox Android invoices only**, set both Xendit redirect URLs explicitly to:

```text
https://onetone.kanuraga.web.id/payment/sandbox-return
```

This is a **public, static, account-neutral page**. It does not load customer/order data, display an order number or claim payment success/failure. It tells the user to return manually to OneTone Mobile and tap **Perbarui Status Pesanan**. Both successful and unsuccessful returns intentionally show the same page.

- Existing website orders continue to use their current redirects.
- Existing SBX invoices retain the redirect configured when Xendit created them; this change cannot retroactively modify them.
- No automatic app launch/deep link is implemented here; that would require Android verified app-link configuration and separate UAT.
- Payment remains authoritative only after validated Xendit callback and a read-only authenticated order status request.
- No database schema, inventory, production branch, Xendit webhook settings, or live payments change.

## Review and testing

1. Review the PR and verify TypeScript and unit tests pass, then decide whether to merge into `main` for Kanuraga staging deployment. Keep production branch unchanged.
2. Verify the static landing page on staging:
   `https://onetone.kanuraga.web.id/payment/sandbox-return` should work even when signed out of Chrome, **without exposing order, identity or invoice details**.
3. If testing another payment, create **one new, cheap TEST order** from the signed Android testing APK with `enable_sandbox_checkout=true`; verify Xendit Test Mode and staging feature flag beforehand.
4. Simulate the payment once on Xendit TEST. The browser should land on the **neutral instruction page**, regardless of whether Chrome is signed in as admin, another customer or signed out. It must not display a customer profile or detailed order.
5. Switch to the existing APK **Pesanan TEST** screen and tap **Perbarui Status Pesanan**. Verify status `packing` + invoice `paid` only after backend webhook, and no second order/stock movement.
6. Repeat logged-out browser test, using a *different new disposable TEST invoice* only when necessary, to verify redirect does not depend on a browser cookie. Avoid repeated orders or production payments.
7. Retain ownership regression tests for `getOrder` and `GET /api/orders/[id]`. An unrelated non-admin web user should never read another customer's order even by guessing the ID.

## Further work

For a polished production UX, design a verified HTTPS Android App Link handoff with a **non-sensitive return indicator**, validate app ownership and exact order in the authenticated API, support resuming a pending order after app restart, and show receipt/order history. **Never** place a Bearer token, phone, email, invoice URL or other PII into a deep-link query parameter. Web checkout live security/fulfillment remains a separate launch gate.
