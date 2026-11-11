# OneTone — Biteship shipment readiness UAT v0.1

Date: 11 November 2026. Backend `one2pret/onetone-store`, Kanuraga **staging only**.
**This PR does not create a shipment, waybill, pickup, API request, state transition, or inventory mutation.**

## Why now?

Android checkout → Xendit Test Mode → PAID callback → status `packing` is verified. PAID replay and EXPIRED stock restoration/replay are also verified on staging. However, shipping remains a separate lifecycle. Clicking the old **Kirim Order ke Kurir** button can invoke `POST /v1/orders` at Biteship and create an external shipment, not merely a quote.

**Important Biteship contract:** The API hostname is `https://api.biteship.com` for both modes; the token determines live vs test. Biteship sandbox keys start with `biteship_test.` and TEST orders simulate pickup without real courier. See https://biteship.com/en/docs/sandbox and https://help.biteship.com/hc/en-us/articles/58597705576985-How-to-Simulate-Test-Orders-as-Delivered-or-Cancelled-in-Biteship .

## UI introduced here

Admin staging → Pesanan → open any **SBX-** order. The legacy **Kirim Pesanan**, **Batalkan Pesanan** and **Update Status** controls are suppressed in the order detail UI, in addition to the server guards already present in the code. Normal non-SBX orders keep their existing UI.

If a signed-in admin opens a **paid / packing** SBX order, a new **Persiapan Pengiriman — TESTING** panel performs read-only checks:

1. Xendit invoice is `paid` and order is `packing`.
2. Server Biteship API key has the **TEST** prefix (the key is never printed). This checks only the prefix, NOT token validity.
3. Origin name, phone, address and non-zero valid coordinates are configured.
4. Destination name, phone, address and non-zero coordinates exist.
5. Stored courier company and service code are present.
6. Each order item has positive integer quantity, positive unit price and positive per-unit weight in grams.
7. There is no existing `trackingId` or `waybillId` for that order.

The panel also shows **estimated total grams = sum(unit weight × quantity)**. Weight is currently read from the **current master product**, not a historical immutable checkout snapshot; this limitation must be addressed before the actual fulfillment release. All checks passing means basic data is ready for further review, **not that shipment is authorized**.

## Critical pre-shipment findings

- Existing legacy `sendOrderToBitship` builds `items[].weight = unitWeight * quantity` and `items[].value = unitPrice * quantity` while ALSO passing `items[].quantity` to Biteship. Biteship documentation gives `value` and `weight` as item values and calculates declared goods value as `sum(items[].value * items[].quantity)`. Thus the current multi-quantity mapping could **double multiply** weight/value and needs a separately tested fix before shipment creation.
- The existing Biteship client does not pass a stable `reference_id` when creating a shipment and has no resilient external idempotency/reconciliation for network timeout after Biteship may have created an order. Don't simply repeat a request after a timeout.
- The current admin action for ordinary website orders calls Biteship `createShipment`, sets shipping/tracking status, and writes order status in separate operations, not a single transaction. Its fulfillment workflow needs independent review.
- Production shipment creation should require explicit environment/credential controls, restricted admin permission, before/after audit trail and rollback/reconciliation plan.
- A valid API key **prefix alone** is not sufficient to guarantee the environment behaves as expected. Verify API key type in the Biteship dashboard without pasting secrets to GitHub or chat.
- Biteship tracking/waybill is not evidence that a package has actually been picked up; pickup/delivery state must follow courier events.

Official references:
- https://biteship.com/en/docs/api/base_url
- https://biteship.com/en/docs/api/orders/create
- https://biteship.com/en/docs/api/rates/retrieve
- https://biteship.com/en/docs/sandbox

## Safe UAT (no courier API requests)

1. Review and merge the PR **only after CI is green**. Merge to `main` triggers Kanuraga staging deployment; the production branch remains unchanged.
2. In staging, visit the existing paid SBX test order, e.g. order #31 or the later paid order. Confirm status `Dikemas` and invoice `Paid`.
3. Find the **Persiapan Pengiriman — TESTING** checklist. Check all warnings. If Biteship key is live or not present, the TEST key check must be **red**. Do not paste the key itself.
4. Verify the old **Kirim Order ke Kurir**, **Batalkan Pesanan** and **Update Status** buttons are **not** visible for SBX. The server still protects against direct calls.
5. Open a non-SBX order in admin and verify its existing controls are unchanged.
6. Reload the SBX page: no new tracking ID, no shipping history entry, no status change, no courier pickup and no inventory movement should be created. No APK rebuild is needed.
7. If all checks pass, continue with a **separate** sandbox-only fulfillment implementation PR using `biteship_test.` credentials, per-unit item mapping, concurrency-safe idempotency, and explicit UAT confirmation before any POST.

## Launch gate

This milestone only exposes missing configuration/data and removes misleading legacy buttons for SBX. The next action is to design and test safe sandbox shipment creation followed by tracking/waybill and cancellation/refund workflows. Do **not** enable live Biteship shipments or claim full e-commerce launch readiness from this readiness panel.