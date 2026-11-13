import { createHash } from 'node:crypto';
import type { BitshipShipmentRequest } from '@/lib/bitship';
import { evaluateSandboxShipmentReadiness, isBiteshipSandboxApiKey, type ShipmentReadinessInput } from './sandbox-shipment-readiness';
import { isSandboxOrder } from './sandbox-legacy-guard';

export type SandboxPayload = BitshipShipmentRequest & { reference_id: string };

// Diagnostics must report the dedicated TEST credential independently of
// the booking switch. Prefix detection is not provider authentication.
export function sandboxBookingTestKeyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isBiteshipSandboxApiKey(env.BITESHIP_SANDBOX_API_KEY);
}

export function sandboxBookingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BITESHIP_SANDBOX_BOOKING_ENABLED === 'true' &&
    ['staging', 'test'].includes(env.APP_ENV ?? '') &&
    sandboxBookingTestKeyConfigured(env);
}

export function buildSandboxBookingPayload(orderNumber: string, input: ShipmentReadinessInput): SandboxPayload {
  if (!isSandboxOrder(orderNumber) || !evaluateSandboxShipmentReadiness(input).dataComplete ||
      !input.items.every(item => Number.isSafeInteger(item.unitPrice) &&
        Number.isSafeInteger(item.unitPrice * item.quantity) &&
        Number.isSafeInteger(item.weightGrams! * item.quantity)) ||
      !Number.isSafeInteger(input.items.reduce((sum, item) => sum + item.weightGrams! * item.quantity, 0)) ||
      !Number.isSafeInteger(input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)) ||
      !/^[a-z0-9_-]+$/.test(input.shipping?.courierCompany ?? '') ||
      !/^[a-z0-9_-]+$/.test(input.shipping?.courierType ?? '')) {
    throw new Error('Data booking belum valid; snapshot berat checkout wajib tersedia.');
  }
  const shipping = input.shipping!;
  return {
    reference_id: `onetone-sbx-${orderNumber}`,
    origin_contact_name: input.origin.contactName!,
    origin_contact_phone: input.origin.contactPhone!,
    origin_address: input.origin.address!,
    origin_coordinate: { latitude: Number(input.origin.latitude), longitude: Number(input.origin.longitude) },
    destination_contact_name: shipping.recipientName!,
    destination_contact_phone: shipping.phone!,
    destination_address: shipping.address!,
    destination_coordinate: { latitude: Number(shipping.latitude), longitude: Number(shipping.longitude) },
    courier_company: shipping.courierCompany!, courier_type: shipping.courierType!,
    delivery_type: 'now',
    items: input.items.map(item => ({ name: item.name, weight: item.weightGrams!, quantity: item.quantity, value: item.unitPrice })),
  };
}

export function bookingSnapshotHash(payload: SandboxPayload): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export type BookingResult = {
  status: 'booked' | 'rejected' | 'needs_reconciliation';
  event: 'confirmed' | 'api_rejected' | 'duplicate_reference' | 'unknown_outcome' | 'reconciled' | 'reconciliation_unverified';
  externalOrderId?: string;
  waybillId?: string | null;
  courierTrackingId?: string | null;
};

function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,255}$/.test(value);
}

// A separate credential and fixed origin prevent legacy/live configuration fallback.
async function sandboxFetch(path: string, options: RequestInit): Promise<Response> {
  if (!sandboxBookingEnabled()) throw new Error('Booking sandbox dinonaktifkan.');
  return fetch(`https://api.biteship.com/v1/orders${path}`, {
    ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.BITESHIP_SANDBOX_API_KEY}` },
  });
}

export async function requestSandboxBooking(payload: SandboxPayload): Promise<BookingResult> {
  // Guard failures happen before an attempted POST, but the reservation remains permanent.
  if (!sandboxBookingEnabled()) throw new Error('Booking sandbox dinonaktifkan.');
  try {
    const response = await sandboxFetch('', { method: 'POST', body: JSON.stringify(payload) });
    const body = await response.json();
    if (String(body.code) === '40002060') return {
      status: 'needs_reconciliation', event: 'duplicate_reference',
      externalOrderId: body.details?.reference_id === payload.reference_id && identifier(body.details?.order_id)
        ? body.details.order_id : undefined,
    };
    if (response.ok && body.success === true && identifier(body.id) &&
        (body.reference_id == null || body.reference_id === payload.reference_id)) {
      return { status: 'booked', event: 'confirmed', externalOrderId: body.id,
        waybillId: identifier(body.courier?.waybill_id) ? body.courier.waybill_id : null,
        courierTrackingId: identifier(body.courier?.tracking_id) ? body.courier.tracking_id : null };
    }
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      return { status: 'rejected', event: 'api_rejected' };
    }
  } catch { /* A response may be lost after the provider accepted the order. */ }
  return { status: 'needs_reconciliation', event: 'unknown_outcome' };
}

export async function retrieveSandboxBooking(externalId: string, referenceId: string): Promise<BookingResult> {
  if (!identifier(externalId)) throw new Error('ID Biteship tidak valid.');
  if (!sandboxBookingEnabled()) throw new Error('Booking sandbox dinonaktifkan.');
  try {
    const response = await sandboxFetch(`/${encodeURIComponent(externalId)}`, { method: 'GET' });
    const body = await response.json();
    if (response.ok && body.success === true && body.id === externalId && body.reference_id === referenceId) {
      return { status: 'booked', event: 'reconciled', externalOrderId: body.id,
        waybillId: identifier(body.courier?.waybill_id) ? body.courier.waybill_id : null,
        courierTrackingId: identifier(body.courier?.tracking_id) ? body.courier.tracking_id : null };
    }
  } catch { /* Keep the reservation blocked until an authoritative GET succeeds. */ }
  return { status: 'needs_reconciliation', event: 'reconciliation_unverified' };
}
