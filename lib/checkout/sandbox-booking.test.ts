import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { bookingSnapshotHash, buildSandboxBookingPayload, requestSandboxBooking, retrieveSandboxBooking, sandboxBookingEnabled, sandboxBookingTestKeyConfigured } from './sandbox-booking';
import type { ShipmentReadinessInput } from './sandbox-shipment-readiness';

const valid: ShipmentReadinessInput = {
  orderStatus: 'packing', invoiceStatus: 'paid', hasSandboxBiteshipKey: true, hasTracking: false,
  origin: { contactName: 'Test', contactPhone: '08123456789', address: 'Test origin', latitude: '-6.2', longitude: '106.8' },
  shipping: { recipientName: 'Test', phone: '08123456789', address: 'Test destination', latitude: '-6.3', longitude: '106.9', courierCompany: 'jne', courierType: 'reg' },
  items: [{ name: 'Test', quantity: 3, unitPrice: 25000, weightGrams: 200 }],
};
const payload = () => buildSandboxBookingPayload('SBX-test', valid);
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv('APP_ENV', 'test');
  vi.stubEnv('BITESHIP_SANDBOX_BOOKING_ENABLED', 'true');
  vi.stubEnv('BITESHIP_SANDBOX_API_KEY', 'biteship_test.mock');
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('sandbox payload', () => {
  it('maps unit grams and IDR without multiplying quantity twice', () => {
    expect(payload().items).toEqual([{ name: 'Test', quantity: 3, value: 25000, weight: 200 }]);
    expect(payload().reference_id).toBe('onetone-sbx-SBX-test');
  });
  it.each([null, 0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER])('rejects invalid unit weight %s', weightGrams => {
    expect(() => buildSandboxBookingPayload('SBX-test', { ...valid, items: [{ ...valid.items[0], weightGrams }] })).toThrow();
  });
  it.each(['waiting_payment', 'expired', 'cancelled', 'shipping'])('rejects order %s', orderStatus => {
    expect(() => buildSandboxBookingPayload('SBX-test', { ...valid, orderStatus })).toThrow();
  });
  it.each(['pending', 'expired', 'cancelled', undefined])('rejects invoice %s', invoiceStatus => {
    expect(() => buildSandboxBookingPayload('SBX-test', { ...valid, invoiceStatus })).toThrow();
  });
  it('rejects ordinary orders, existing tracking, incomplete routes and invalid services', () => {
    expect(() => buildSandboxBookingPayload('ORD-test', valid)).toThrow();
    for (const patch of [{ hasTracking: true }, { origin: {} }, { shipping: null },
      { shipping: { ...valid.shipping, latitude: '91' } },
      { shipping: { ...valid.shipping, courierType: 'invalid service' } },
      { items: [{ ...valid.items[0], unitPrice: 2.5 }] }]) {
      expect(() => buildSandboxBookingPayload('SBX-test', { ...valid, ...patch })).toThrow();
    }
  });
  it('binds confirmation to all shipment fields', () => {
    expect(bookingSnapshotHash(payload())).toBe(bookingSnapshotHash(payload()));
    expect(bookingSnapshotHash({ ...payload(), origin_address: 'Changed' })).not.toBe(bookingSnapshotHash(payload()));
  });
});

describe('sandbox key diagnostic independent of booking gate', () => {
  it('shows a TEST key as configured while booking is disabled', () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('BITESHIP_SANDBOX_BOOKING_ENABLED', 'false');
    vi.stubEnv('BITESHIP_SANDBOX_API_KEY', 'biteship_test.mock');
    expect(sandboxBookingTestKeyConfigured()).toBe(true);
    expect(sandboxBookingEnabled()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never treats a live or missing key as configured', () => {
    vi.stubEnv('BITESHIP_SANDBOX_API_KEY', 'biteship_live.mock');
    expect(sandboxBookingTestKeyConfigured()).toBe(false);
    vi.stubEnv('BITESHIP_SANDBOX_API_KEY', '');
    expect(sandboxBookingTestKeyConfigured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sandbox transport fence and reconciliation', () => {
  it.each([
    { APP_ENV: 'production' }, { APP_ENV: '' }, { BITESHIP_SANDBOX_BOOKING_ENABLED: 'false' },
    { BITESHIP_SANDBOX_API_KEY: 'biteship_live.mock' }, { BITESHIP_SANDBOX_API_KEY: '' },
  ])('blocks invalid config %j without fetching', async patch => {
    for (const [key, value] of Object.entries(patch)) vi.stubEnv(key, value);
    vi.stubEnv('BITSHIP_API_KEY', 'biteship_test.legacy');
    expect(sandboxBookingEnabled()).toBe(false);
    await expect(requestSandboxBooking(payload())).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('uses dedicated test key and fixed URL; persists separate external and courier IDs', async () => {
    vi.stubEnv('BITSHIP_API_URL', 'https://invalid.example');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, id: 'external', courier: { tracking_id: 'tracking', waybill_id: 'waybill' } })));
    expect(await requestSandboxBooking(payload())).toMatchObject({ status: 'booked', externalOrderId: 'external', courierTrackingId: 'tracking', waybillId: 'waybill' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.biteship.com/v1/orders', expect.objectContaining({ method: 'POST', redirect: 'error', headers: expect.objectContaining({ Authorization: 'Bearer biteship_test.mock' }) }));
  });
  it.each([400, 401, 422])('records definitive rejection %s', async status => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false }), { status }));
    expect(await requestSandboxBooking(payload())).toMatchObject({ status: 'rejected' });
  });
  it.each([408, 429, 500, 502])('keeps ambiguous HTTP %s blocked', async status => {
    fetchMock.mockResolvedValue(new Response('{}', { status }));
    expect(await requestSandboxBooking(payload())).toMatchObject({ status: 'needs_reconciliation' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not retry a timeout after external success', async () => {
    fetchMock.mockRejectedValue(new Error('timeout after commit'));
    expect(await requestSandboxBooking(payload())).toMatchObject({ status: 'needs_reconciliation' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('handles duplicate reference explicitly, then verifies via GET', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 40002060 }), { status: 400 }));
    expect(await requestSandboxBooking(payload())).toMatchObject({ event: 'duplicate_reference' });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, id: 'external', reference_id: payload().reference_id })));
    expect(await retrieveSandboxBooking('external', payload().reference_id)).toMatchObject({ status: 'booked', event: 'reconciled' });
    expect(fetchMock.mock.calls[1][1].method).toBe('GET');
  });
  it('rejects mismatched or absent reference evidence and unsafe IDs', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, id: 'external', reference_id: 'other' })));
    expect(await retrieveSandboxBooking('external', payload().reference_id)).toMatchObject({ status: 'needs_reconciliation' });
    await expect(retrieveSandboxBooking('../orders', payload().reference_id)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('retains a duplicate-response candidate only with matching reference evidence', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 40002060,
      details: { order_id: 'external', reference_id: payload().reference_id } }), { status: 400 }));
    expect(await requestSandboxBooking(payload())).toMatchObject({ status: 'needs_reconciliation', externalOrderId: 'external' });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 40002060,
      details: { order_id: 'wrong', reference_id: 'other' } }), { status: 400 }));
    expect((await requestSandboxBooking(payload())).externalOrderId).toBeUndefined();
  });
  it('treats malformed success as uncertain', async () => {
    fetchMock.mockResolvedValue(new Response('not json'));
    expect(await requestSandboxBooking(payload())).toMatchObject({ status: 'needs_reconciliation' });
  });
});
