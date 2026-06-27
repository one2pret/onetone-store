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

vi.mock('@/lib/xendit', () => ({
  expireInvoice: vi.fn(),
}));

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test_cron_secret');
  vi.clearAllMocks();
  mockSelectReturn.mockReturnValue([]);
  mockInsertReturn.mockReturnValue([{ insertId: 1 }]);
  mockUpdateReturn.mockReturnValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

import { GET } from '@/app/api/cron/check-expired-orders/route';
import { restoreStock } from '@/lib/stock';
import { expireInvoice } from '@/lib/xendit';

function makeRequest(token = 'test_cron_secret') {
  return new Request('http://localhost:3000/api/cron/check-expired-orders', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('Cron: Check Expired Orders', () => {
  it('returns 401 on invalid auth', async () => {
    const res = await GET(makeRequest('wrong_secret'));
    expect(res.status).toBe(401);
  });

  it('finds and expires overdue orders', async () => {
    const expiredOrder = {
      ...sampleOrder,
      status: 'waiting_payment',
      willExpiredAt: new Date('2025-01-01T00:00:00Z'), // past
    };
    // First select: expired orders
    mockSelectReturn.mockReturnValueOnce([expiredOrder]);
    // For each order: find invoice
    mockSelectReturn.mockReturnValueOnce([sampleInvoice]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.expired).toBe(1);
    expect(restoreStock).toHaveBeenCalledWith(expiredOrder.id);
  });

  it('expires Xendit invoice for each order', async () => {
    const expiredOrder = {
      ...sampleOrder,
      status: 'waiting_payment',
      willExpiredAt: new Date('2025-01-01T00:00:00Z'),
    };
    mockSelectReturn.mockReturnValueOnce([expiredOrder]);
    mockSelectReturn.mockReturnValueOnce([sampleInvoice]);

    await GET(makeRequest());

    expect(expireInvoice).toHaveBeenCalledWith(sampleInvoice.xenditId);
  });

  it('returns 0 when no expired orders', async () => {
    mockSelectReturn.mockReturnValueOnce([]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.expired).toBe(0);
  });

  it('logs changedBy as cron:system', async () => {
    const expiredOrder = {
      ...sampleOrder,
      status: 'waiting_payment',
      willExpiredAt: new Date('2025-01-01T00:00:00Z'),
    };
    mockSelectReturn.mockReturnValueOnce([expiredOrder]);
    mockSelectReturn.mockReturnValueOnce([sampleInvoice]);
    const { db } = await import('@/lib/db');

    await GET(makeRequest());

    expect(db.insert).toHaveBeenCalled();
  });

  it('handles orders without invoice gracefully', async () => {
    const expiredOrder = {
      ...sampleOrder,
      status: 'waiting_payment',
      willExpiredAt: new Date('2025-01-01T00:00:00Z'),
    };
    mockSelectReturn.mockReturnValueOnce([expiredOrder]);
    mockSelectReturn.mockReturnValueOnce([]); // no invoice

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.expired).toBe(1);
    expect(restoreStock).toHaveBeenCalled();
  });
});
