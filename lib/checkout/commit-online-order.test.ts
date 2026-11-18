import { describe, expect, it, vi } from 'vitest';

// This suite verifies compatibility without creating a real order or opening
// a database connection. Full transaction & concurrency tests are separate
// release blockers for any production route using the shared kernel.
vi.mock('@/lib/db', () => ({ db: {} }));

import {
  commitOnlineOrderAtomically,
  CheckoutRejected as SharedCheckoutRejected,
} from './commit-online-order';
import {
  commitSandboxOrder,
  CheckoutRejected as SandboxCheckoutRejected,
} from './commit-sandbox-order';

describe('shared checkout atomic kernel extraction', () => {
  it('maintains exact function identity for the staging sandbox route', () => {
    expect(commitSandboxOrder).toBe(commitOnlineOrderAtomically);
  });

  it('maintains the existing rejected error class and HTTP status metadata', () => {
    expect(SandboxCheckoutRejected).toBe(SharedCheckoutRejected);
    const error = new SandboxCheckoutRejected(409, 'Stok Gudang Online tidak mencukupi');
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(409);
    expect(error.message).toContain('Stok');
  });
});
