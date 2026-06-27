import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLoginResult = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  loginWithCredentials: (...args: any[]) => mockLoginResult(...args),
  getApiUser: vi.fn(() =>
    Promise.resolve({ id: 2, name: 'John', email: 'john@example.com', role: 'customer', phone: '08123456789' })
  ),
}));

import { POST as login } from '@/app/api/auth/login/route';
import { GET as me } from '@/app/api/auth/me/route';

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('returns token and user on valid credentials', async () => {
      mockLoginResult.mockResolvedValue({
        user: { id: 2, name: 'John', email: 'john@example.com', role: 'customer', phone: null },
        token: 'jwt-token-123',
      });

      const response = await login(
        makeRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'john@example.com', password: 'password123' }),
        })
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.token).toBe('jwt-token-123');
      expect(json.data.user.email).toBe('john@example.com');
    });

    it('returns 401 on invalid credentials', async () => {
      mockLoginResult.mockResolvedValue(null);

      const response = await login(
        makeRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'john@example.com', password: 'wrong' }),
        })
      );

      expect(response.status).toBe(401);
    });

    it('returns 400 on invalid email format', async () => {
      const response = await login(
        makeRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'invalid', password: 'password123' }),
        })
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user profile when authenticated', async () => {
      const response = await me(makeRequest('http://localhost/api/auth/me'));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.email).toBe('john@example.com');
    });

    it('returns 401 when not authenticated', async () => {
      const { getApiUser } = await import('@/lib/api-auth');
      (getApiUser as any).mockResolvedValueOnce(null);

      const response = await me(makeRequest('http://localhost/api/auth/me'));
      expect(response.status).toBe(401);
    });
  });
});
