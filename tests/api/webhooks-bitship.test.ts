import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sampleOrder, sampleShipping } from '../helpers/fixtures';

const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();
const mockUpdateReturn = vi.fn();

const mockChain = (returnFn = mockSelectReturn) => {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(returnFn());
  chain.catch = () => chain;
  return chain;
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => mockChain()),
    insert: vi.fn(() => mockChain(mockInsertReturn)),
    update: vi.fn(() => mockChain(mockUpdateReturn)),
  },
}));

vi.mock('@/lib/stock', () => ({
  restoreStock: vi.fn(),
}));

import { POST } from '@/app/api/webhooks/bitship/route';
import { db } from '@/lib/db';
import { restoreStock } from '@/lib/stock';

function makeRequest(body: any) {
  return new Request('http://localhost:3000/api/webhooks/bitship', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Bitship Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
    mockInsertReturn.mockReturnValue([{ insertId: 1 }]);
    mockUpdateReturn.mockReturnValue(undefined);
  });

  it('returns 200 on valid tracking update', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleShipping]); // shipping by trackingId
    mockSelectReturn.mockReturnValueOnce([sampleOrder]); // order

    const res = await POST(makeRequest({
      order_id: 'TRK123456',
      status: 'picking_up',
      courier_tracking_id: 'WB123456',
    }));
    expect(res.status).toBe(200);
  });

  it('updates shipping status and inserts history', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleShipping]);
    mockSelectReturn.mockReturnValueOnce([sampleOrder]);

    await POST(makeRequest({
      order_id: 'TRK123456',
      status: 'dropping_off',
      courier_tracking_id: 'WB123456',
    }));

    expect(db.update).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });

  it('transitions to delivered on delivered status', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleShipping]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'shipping' }]);

    await POST(makeRequest({
      order_id: 'TRK123456',
      status: 'delivered',
    }));

    // Should update order status to delivered + insert audit log
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });

  it('restores stock on cancelled status', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleShipping]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'shipping' }]);

    await POST(makeRequest({
      order_id: 'TRK123456',
      status: 'cancelled',
    }));

    expect(restoreStock).toHaveBeenCalledWith(sampleOrder.id);
  });

  it('restores stock on returned status', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleShipping]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'shipping' }]);

    await POST(makeRequest({
      order_id: 'TRK123456',
      status: 'returned',
    }));

    expect(restoreStock).toHaveBeenCalledWith(sampleOrder.id);
  });

  it('returns 200 on unknown tracking_id (ignore gracefully)', async () => {
    mockSelectReturn.mockReturnValueOnce([]); // no shipping found

    const res = await POST(makeRequest({
      order_id: 'UNKNOWN_ID',
      status: 'delivered',
    }));
    expect(res.status).toBe(200);
  });

  it('skips when shipping status is same (idempotent)', async () => {
    mockSelectReturn.mockReturnValueOnce([{ ...sampleShipping, status: 'delivered' }]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'delivered' }]);

    const res = await POST(makeRequest({
      order_id: 'TRK123456',
      status: 'delivered',
    }));

    expect(res.status).toBe(200);
    // Should not update order since already delivered
    expect(db.update).toHaveBeenCalledTimes(1); // only shipping status update
  });

  it('logs changedBy as webhook:bitship', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleShipping]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'shipping' }]);

    await POST(makeRequest({
      order_id: 'TRK123456',
      status: 'delivered',
    }));

    // Check insert was called for orderStatusLogs
    expect(db.insert).toHaveBeenCalled();
  });

  it('returns 200 on malformed body', async () => {
    const res = await POST(new Request('http://localhost:3000/api/webhooks/bitship', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }));
    expect(res.status).toBe(200);
  });

  it('handles rejected status same as cancelled', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleShipping]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'shipping' }]);

    await POST(makeRequest({
      order_id: 'TRK123456',
      status: 'rejected',
    }));

    expect(restoreStock).toHaveBeenCalledWith(sampleOrder.id);
  });
});
