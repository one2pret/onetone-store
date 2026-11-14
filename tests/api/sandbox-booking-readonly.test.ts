import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  getApiUser: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.select.mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn(() => chain);
      chain.where = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.orderBy = vi.fn(() => chain);
      chain.then = (resolve: (value: unknown) => void) => resolve(mocks.read());
      return chain;
    }),
  },
}));

vi.mock('@/lib/api-auth', () => ({ getApiUser: mocks.getApiUser }));

import { GET as tracking } from '@/app/api/orders/[id]/tracking/route';
import { GET as detail } from '@/app/api/orders/[id]/route';

const req = (suffix: string) => new Request('http://localhost/api/orders/42' + suffix);
const params = { params: Promise.resolve({ id: '42' }) };
const sbxOrder = { id: 42, userId: 2, orderNumber: 'SBX-test', status: 'packing' };
const storedBooking = { mode: 'sandbox', status: 'booked', waybillId: 'WYB-TEST', snapshot: 'PRIVATE_ADDRESS', externalOrderId: 'PRIVATE_ID' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_ENV', 'staging');
  vi.stubEnv('BITESHIP_SANDBOX_BOOKING_ENABLED', 'false');
  mocks.getApiUser.mockResolvedValue({ id: 2, role: 'customer' });
  mocks.read.mockReturnValue([]);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('Biteship TEST read-only tracking API', () => {
  it('returns minimal booked summary to its owner even with POST gate disabled', async () => {
    mocks.read.mockReturnValueOnce([sbxOrder])
      .mockReturnValueOnce([storedBooking])
      .mockReturnValueOnce([{ id: 8, orderId: 42, courierName: 'JNE' }])
      .mockReturnValueOnce([]);
    const response = await tracking(req('/tracking'), params);
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.sandboxBooking).toEqual({ mode: 'sandbox', status: 'booked', waybillId: 'WYB-TEST' });
    expect(data.shipping.courierName).toBe('JNE');
    expect(JSON.stringify(data.sandboxBooking)).not.toContain('PRIVATE');
    expect(mocks.select).toHaveBeenCalledTimes(4);
  });

  it('never queries booking for a normal order', async () => {
    mocks.read.mockReturnValueOnce([{ ...sbxOrder, orderNumber: 'ORD-normal' }])
      .mockReturnValueOnce([]);
    const response = await tracking(req('/tracking'), params);
    expect((await response.json()).data.sandboxBooking).toBeNull();
    expect(mocks.select).toHaveBeenCalledTimes(2);
  });

  it('never queries booking in production even for a SBX number', async () => {
    vi.stubEnv('APP_ENV', 'production');
    mocks.read.mockReturnValueOnce([sbxOrder]).mockReturnValueOnce([]);
    const response = await tracking(req('/tracking'), params);
    expect((await response.json()).data.sandboxBooking).toBeNull();
    expect(mocks.select).toHaveBeenCalledTimes(2);
  });

  it('rejects an unauthenticated caller before any DB read', async () => {
    mocks.getApiUser.mockResolvedValueOnce(null);
    const response = await tracking(req('/tracking'), params);
    expect(response.status).toBe(401);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('rejects another customer before any booking or shipping read', async () => {
    mocks.read.mockReturnValueOnce([{ ...sbxOrder, userId: 99 }]);
    const response = await tracking(req('/tracking'), params);
    expect(response.status).toBe(403);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});

describe('Biteship TEST order detail API', () => {
  it('includes the same minimal status field for an authorized customer', async () => {
    mocks.read.mockReturnValueOnce([sbxOrder])
      .mockReturnValueOnce([{ id: 1, orderId: 42, productName: 'Item' }])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ id: 8, orderId: 42, courierName: 'JNE' }])
      .mockReturnValueOnce([]) // legacy shipping histories
      .mockReturnValueOnce([storedBooking]);
    const response = await detail(req(''), params);
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.sandboxBooking).toEqual({ mode: 'sandbox', status: 'booked', waybillId: 'WYB-TEST' });
    expect(JSON.stringify(data.sandboxBooking)).not.toContain('PRIVATE');
    expect(mocks.select).toHaveBeenCalledTimes(6);
  });

  it('denies another customer without exposing the booking', async () => {
    mocks.read.mockReturnValueOnce([{ ...sbxOrder, userId: 77 }]);
    const response = await detail(req(''), params);
    expect(response.status).toBe(403);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});
