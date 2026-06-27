import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve(mockSelectReturn());
      chain.catch = () => chain;
      return chain;
    }),
    insert: vi.fn(() => {
      const chain: any = {};
      chain.values = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve(mockInsertReturn());
      chain.catch = () => chain;
      return chain;
    }),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('$2a$10$hashed')),
  },
}));

import { POST } from '@/app/api/auth/register/route';

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
    mockInsertReturn.mockReturnValue([{ insertId: 3 }]);
  });

  it('registers a new user', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New User',
          email: 'new@example.com',
          password: 'password123',
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.email).toBe('new@example.com');
  });

  it('rejects duplicate email', async () => {
    mockSelectReturn.mockReturnValue([{ id: 1, email: 'existing@example.com' }]);

    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User',
          email: 'existing@example.com',
          password: 'password123',
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('validates required fields', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', email: '', password: '' }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });
});
