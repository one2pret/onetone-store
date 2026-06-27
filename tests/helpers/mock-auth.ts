import { vi } from 'vitest';

type MockUser = {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
};

const mockUsers: Record<string, MockUser> = {
  customer: {
    id: '2',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'customer',
  },
  admin: {
    id: '1',
    name: 'Admin Store',
    email: 'admin@store.com',
    role: 'admin',
  },
};

export function mockAuthSession(type: 'customer' | 'admin' | 'none') {
  const session = type === 'none' ? null : { user: mockUsers[type] };

  vi.mock('@/lib/auth', () => ({
    auth: vi.fn(() => Promise.resolve(session)),
    getCurrentUser: vi.fn(() =>
      Promise.resolve(type === 'none' ? null : mockUsers[type])
    ),
    isAdmin: vi.fn(() => Promise.resolve(type === 'admin')),
  }));

  return session;
}
