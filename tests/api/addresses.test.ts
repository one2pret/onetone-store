import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sampleAddress } from '../helpers/fixtures';

const mockSelectReturn = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve(mockSelectReturn());
      chain.catch = () => chain;
      return chain;
    }),
    insert: vi.fn(() => {
      const chain: any = {};
      chain.values = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve([{ insertId: 10 }]);
      chain.catch = () => chain;
      return chain;
    }),
    update: vi.fn(() => {
      const chain: any = {};
      chain.set = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve(undefined);
      chain.catch = () => chain;
      return chain;
    }),
    delete: vi.fn(() => {
      const chain: any = {};
      chain.where = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve(undefined);
      chain.catch = () => chain;
      return chain;
    }),
  },
}));

vi.mock('@/lib/api-auth', () => ({
  getApiUser: vi.fn(() =>
    Promise.resolve({ id: 2, name: 'John', email: 'john@example.com', role: 'customer', phone: null })
  ),
}));

import { GET, POST } from '@/app/api/addresses/route';
import { GET as getOne, PUT, DELETE } from '@/app/api/addresses/[id]/route';
import { PUT as setDefault } from '@/app/api/addresses/[id]/default/route';

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('Addresses API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
  });

  describe('GET /api/addresses', () => {
    it('returns user addresses', async () => {
      mockSelectReturn.mockReturnValue([sampleAddress]);

      const response = await GET(makeRequest('http://localhost/api/addresses'));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].recipientName).toBe('John Doe');
    });

    it('returns 401 when not authenticated', async () => {
      const { getApiUser } = await import('@/lib/api-auth');
      (getApiUser as any).mockResolvedValueOnce(null);

      const response = await GET(makeRequest('http://localhost/api/addresses'));
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/addresses', () => {
    it('creates a new address', async () => {
      mockSelectReturn.mockReturnValueOnce([{ ...sampleAddress, id: 10 }]); // fetch created

      const response = await POST(
        makeRequest('http://localhost/api/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: 'Jane Doe',
            phone: '08123456789',
            address: 'Jl. Baru No. 10, Jakarta Pusat',
            province: 'DKI Jakarta',
            city: 'Jakarta Pusat',
            district: 'Menteng',
            postalCode: '10310',
          }),
        })
      );
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it('validates required fields', async () => {
      const response = await POST(
        makeRequest('http://localhost/api/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientName: 'Jane' }), // missing fields
        })
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/addresses/[id]', () => {
    it('returns address owned by user', async () => {
      mockSelectReturn.mockReturnValue([sampleAddress]);

      const response = await getOne(
        makeRequest('http://localhost/api/addresses/1'),
        makeParams('1'),
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.id).toBe(1);
    });

    it('returns 404 for address owned by another user', async () => {
      mockSelectReturn.mockReturnValue([{ ...sampleAddress, userId: 999 }]);

      const response = await getOne(
        makeRequest('http://localhost/api/addresses/1'),
        makeParams('1'),
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/addresses/[id]', () => {
    it('updates owned address', async () => {
      mockSelectReturn
        .mockReturnValueOnce([sampleAddress]) // ownership check
        .mockReturnValueOnce([{ ...sampleAddress, recipientName: 'Updated' }]); // fetch updated

      const response = await PUT(
        makeRequest('http://localhost/api/addresses/1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientName: 'Updated' }),
        }),
        makeParams('1'),
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('DELETE /api/addresses/[id]', () => {
    it('deletes owned address', async () => {
      mockSelectReturn.mockReturnValue([sampleAddress]);

      const response = await DELETE(
        makeRequest('http://localhost/api/addresses/1', { method: 'DELETE' }),
        makeParams('1'),
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('returns 404 for non-existent address', async () => {
      mockSelectReturn.mockReturnValue([]);

      const response = await DELETE(
        makeRequest('http://localhost/api/addresses/999', { method: 'DELETE' }),
        makeParams('999'),
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/addresses/[id]/default', () => {
    it('sets address as default', async () => {
      mockSelectReturn.mockReturnValue([sampleAddress]);

      const response = await setDefault(
        makeRequest('http://localhost/api/addresses/1/default', { method: 'PUT' }),
        makeParams('1'),
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });
});
