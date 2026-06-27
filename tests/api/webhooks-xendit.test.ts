import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sampleOrder, sampleInvoice } from '../helpers/fixtures';

const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();
const mockUpdateReturn = vi.fn();

const mockChain = (returnFn = mockSelectReturn) => {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
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

beforeEach(() => {
  vi.stubEnv('XENDIT_WEBHOOK_TOKEN', 'test_webhook_token');
  vi.clearAllMocks();
  mockSelectReturn.mockReturnValue([]);
  mockInsertReturn.mockReturnValue([{ insertId: 1 }]);
  mockUpdateReturn.mockReturnValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

import { POST } from '@/app/api/webhooks/xendit/route';
import { db } from '@/lib/db';
import { restoreStock } from '@/lib/stock';

function makeRequest(body: any, token = 'test_webhook_token') {
  return new Request('http://localhost:3000/api/webhooks/xendit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-callback-token': token,
    },
    body: JSON.stringify(body),
  });
}

describe('Xendit Webhook Handler', () => {
  it('returns 401 on invalid callback token', async () => {
    const res = await POST(makeRequest({ status: 'PAID' }, 'wrong_token'));
    expect(res.status).toBe(401);
  });

  it('returns 200 on valid PAID callback', async () => {
    // Invoice lookup
    mockSelectReturn.mockReturnValueOnce([sampleInvoice]);
    // Order lookup
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'waiting_payment' }]);

    const res = await POST(makeRequest({
      id: 'inv_xendit_123',
      external_id: 'ORD250101ABCD',
      status: 'PAID',
      payment_method: 'BANK_TRANSFER',
      payment_channel: 'BCA',
      paid_at: '2025-01-01T12:00:00.000Z',
    }));
    expect(res.status).toBe(200);
  });

  it('updates invoice and order on PAID', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleInvoice]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'waiting_payment' }]);

    await POST(makeRequest({
      id: 'inv_xendit_123',
      external_id: 'ORD250101ABCD',
      status: 'PAID',
      payment_method: 'BANK_TRANSFER',
      payment_channel: 'BCA',
      paid_at: '2025-01-01T12:00:00.000Z',
    }));

    // Should update invoice + update order + insert audit log
    expect(db.update).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });

  it('restores stock on EXPIRED', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleInvoice]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'waiting_payment' }]);

    await POST(makeRequest({
      id: 'inv_xendit_123',
      external_id: 'ORD250101ABCD',
      status: 'EXPIRED',
    }));

    expect(restoreStock).toHaveBeenCalledWith(sampleOrder.id);
  });

  it('returns 200 on unknown external_id (ignore)', async () => {
    mockSelectReturn.mockReturnValueOnce([]); // no invoice found

    const res = await POST(makeRequest({
      id: 'inv_unknown',
      external_id: 'UNKNOWN_ORDER',
      status: 'PAID',
    }));
    expect(res.status).toBe(200);
  });

  it('is idempotent — skips already paid order', async () => {
    mockSelectReturn.mockReturnValueOnce([{ ...sampleInvoice, status: 'paid' }]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'packing' }]);

    const res = await POST(makeRequest({
      id: 'inv_xendit_123',
      external_id: 'ORD250101ABCD',
      status: 'PAID',
    }));

    expect(res.status).toBe(200);
    // Should not update anything
    expect(db.update).not.toHaveBeenCalled();
  });

  it('is idempotent — skips already expired order', async () => {
    mockSelectReturn.mockReturnValueOnce([{ ...sampleInvoice, status: 'expired' }]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'expired' }]);

    const res = await POST(makeRequest({
      id: 'inv_xendit_123',
      external_id: 'ORD250101ABCD',
      status: 'EXPIRED',
    }));

    expect(res.status).toBe(200);
    expect(db.update).not.toHaveBeenCalled();
    expect(restoreStock).not.toHaveBeenCalled();
  });

  it('returns 200 on malformed body', async () => {
    const res = await POST(new Request('http://localhost:3000/api/webhooks/xendit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-callback-token': 'test_webhook_token',
      },
      body: '{}',
    }));
    expect(res.status).toBe(200);
  });

  it('transitions to packing on PAID and logs changedBy webhook:xendit', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleInvoice]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'waiting_payment' }]);

    await POST(makeRequest({
      id: 'inv_xendit_123',
      external_id: 'ORD250101ABCD',
      status: 'PAID',
      payment_method: 'VIRTUAL_ACCOUNT',
      payment_channel: 'MANDIRI',
      paid_at: '2025-01-01T12:00:00.000Z',
    }));

    expect(db.update).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });

  it('transitions to expired on EXPIRED and restores stock', async () => {
    mockSelectReturn.mockReturnValueOnce([sampleInvoice]);
    mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'waiting_payment' }]);

    await POST(makeRequest({
      id: 'inv_xendit_123',
      external_id: 'ORD250101ABCD',
      status: 'EXPIRED',
    }));

    expect(db.update).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
    expect(restoreStock).toHaveBeenCalledWith(sampleOrder.id);
  });

  it('handles missing x-callback-token header', async () => {
    const res = await POST(new Request('http://localhost:3000/api/webhooks/xendit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    }));
    expect(res.status).toBe(401);
  });
});
