import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPool: vi.fn(),
  drizzle: vi.fn(),
  onConnection: vi.fn(),
}));

vi.mock('mysql2/promise', () => ({
  default: { createPool: mocks.createPool },
}));

vi.mock('drizzle-orm/mysql2', () => ({
  drizzle: mocks.drizzle,
}));

const globalForTest = globalThis as typeof globalThis & {
  __onetoneMysqlPool?: unknown;
};

describe('database pool lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete globalForTest.__onetoneMysqlPool;
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test_db';
    process.env.NODE_ENV = 'test';

    mocks.createPool.mockReturnValue({
      pool: { on: mocks.onConnection },
    });
    mocks.drizzle.mockReturnValue({});
  });

  afterEach(() => {
    delete globalForTest.__onetoneMysqlPool;
  });

  it('reuses one pool across development-style module reloads', async () => {
    await import('@/lib/db');
    vi.resetModules();
    await import('@/lib/db');

    expect(mocks.createPool).toHaveBeenCalledOnce();
    expect(mocks.onConnection).toHaveBeenCalledOnce();
    expect(mocks.drizzle).toHaveBeenCalledTimes(2);
  });
});
