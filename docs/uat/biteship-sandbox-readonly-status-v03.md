# Biteship TESTING Status v0.3 — Read-only Web and Mobile API

Status: implementation review. Not merged, not deployed, and no provider UAT executed for this milestone.

## Scope
After a Biteship TEST booking has been recorded in `sandbox_bookings`:

- **Admin**: existing booking summary remains visible even after `BITESHIP_SANDBOX_BOOKING_ENABLED=false`; disabled actions are explained clearly.
- **Customer web**: on the authenticated owner-only `/orders/[id]` page, show a separate "Pengiriman Biteship — TESTING" section when a stored SBX booking exists on staging/test. Mark it as a simulation, **not** proof of real-world shipment/pickup.
- **Android-facing APIs**: add the optional `data.sandboxBooking` object to authenticated `GET /api/orders/[id]` and `GET /api/orders/[id]/tracking` after the existing owner/admin authorization check. Android UI is **not** implemented yet.
- **Status**: `booked` / `needs_reconciliation` / `rejected`. Only a `booked` record may display a test waybill.

Example response fragment (all other fields unchanged):

```json
{
  "success": true,
  "data": {
    "sandboxBooking": {
      "mode": "sandbox",
      "status": "booked",
      "waybillId": "WYB-TEST"
    }
  }
}
```

For orders without a recorded SBX booking, ordinary orders, or the production environment, `sandboxBooking` is `null`.

## Security and invariants

1. Both API endpoints enforce authenticated owner/admin access **before querying** `sandbox_bookings`. Customer server-side HTML calls existing owner-checked `getOrder` first.
2. SBX booking reads are enabled only when `APP_ENV=staging` or `test`; independent of the booking POST gate. No production SBX booking lookup or test badge.
3. Query only three columns: `mode`, `booking_status` (mapped to `status`), and `waybill_id`. Never return `snapshot`, `snapshot_hash`, `external_order_id`, pickup/destination contact information or provider credentials.
4. No Biteship HTTP requests, no new webhook, no status sync, no order/shipping/stock/payment mutations. Legacy `shipping`, `trackingHistories` and checkout behavior remain unchanged.
5. `booked` is only a TEST reservation: it must **not** change order status to `shipping`, infer courier pickup, generate a real-world tracking URL or claim a parcel was delivered. A test waybill is explicitly labeled simulation.
6. A non-booked status must not display even a stale/unverified waybill; ambiguous booking stays unresolved.

## Review and staged UAT

- PR CI: TypeScript, unit tests, existing action/route tests, and dedicated integration suite.
- Confirm authenticated sandbox-order owner sees TEST section while `BITESHIP_SANDBOX_BOOKING_ENABLED=false`.
- Confirm another customer cannot access the order web page, order API or tracking API (existing auth + new owner-check tests).
- Confirm normal `ORD-` orders and production responses have `sandboxBooking=null`.
- Confirm legacy shipping/tracking data is unchanged, and no Biteship GET/POST is triggered by a page view.
- Confirm order with status `packing` stays `packing` despite stored `booked` reservation.
- Verify Android client accepts the additive field; the Android UI is a follow-up milestone and should not be described as released.

## Rollback
Stop displaying the new status by rolling back this read-only PR or removing the staging-only read path. Keep all `sandbox_bookings` and audit rows intact. Keep the booking POST gate **OFF** for routine use.
