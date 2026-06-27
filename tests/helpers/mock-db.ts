import { vi } from 'vitest';

// Chainable mock for Drizzle ORM queries
export function createMockDb() {
  const chainable = (resolveValue: any = []) => {
    const chain: any = {
      from: vi.fn().mockReturnValue(chain),
      where: vi.fn().mockReturnValue(chain),
      leftJoin: vi.fn().mockReturnValue(chain),
      orderBy: vi.fn().mockReturnValue(chain),
      limit: vi.fn().mockReturnValue(chain),
      set: vi.fn().mockReturnValue(chain),
      values: vi.fn().mockReturnValue(chain),
      $dynamic: vi.fn().mockReturnValue(chain),
      then: vi.fn((resolve: any) => resolve(resolveValue)),
      [Symbol.toStringTag]: 'Promise',
    };
    // Make the chain awaitable
    chain.then = (resolve: any, reject?: any) => Promise.resolve(resolveValue).then(resolve, reject);
    chain.catch = (reject: any) => Promise.resolve(resolveValue).catch(reject);
    return chain;
  };

  return {
    select: vi.fn(() => chainable()),
    insert: vi.fn(() => chainable([{ insertId: 1 }])),
    update: vi.fn(() => chainable()),
    delete: vi.fn(() => chainable()),
    // Helper to set return value for select queries
    _setSelectReturn: (value: any) => {
      const chain = chainable(value);
      return chain;
    },
  };
}

// Mock the db module
export function mockDbModule(mockDb?: ReturnType<typeof createMockDb>) {
  const db = mockDb || createMockDb();
  vi.mock('@/lib/db', () => ({
    db,
  }));
  return db;
}
