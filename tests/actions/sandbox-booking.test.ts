import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';

const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>, failInsert: false, failResult: false,
  role: 'admin', posts: 0, result: { status: 'booked', event: 'confirmed', externalOrderId: 'external' } as any,
}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { id: '1', role: state.role } })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/checkout/sandbox-booking', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/checkout/sandbox-booking')>(),
  requestSandboxBooking: vi.fn(async () => { state.posts++; return state.result; }),
  retrieveSandboxBooking: vi.fn(async () => state.result),
}));
vi.mock('@/lib/db', () => {
  let tail = Promise.resolve();
  const db = {
    select: () => {
      let name = '';
      const chain: any = { from: (table: any) => { name = getTableName(table); return chain; },
        where: () => chain, for: () => chain, orderBy: () => chain,
        then: (resolve: any) => resolve(state.tables[name] ?? []) };
      return chain;
    },
    insert: (table: any) => ({ values: async (value: any) => {
      const name = getTableName(table);
      if (name === 'sandbox_bookings' && state.failInsert) throw new Error('ER_DUP_ENTRY');
      const rows = state.tables[name] ??= [];
      rows.push({ id: rows.length + 1, requestedAt: new Date(0), ...value });
      return [{ insertId: rows.length }];
    } }),
    update: (table: any) => ({ set: (value: any) => ({ where: async () => {
      if (state.failResult) throw new Error('db unavailable');
      Object.assign(state.tables[getTableName(table)][0], value);
    } }) }),
    transaction: async <T,>(fn: (tx: any) => Promise<T>) => {
      // Model the order row lock. Real MySQL uniqueness is tested separately.
      const previous = tail; let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; }); await previous;
      try { return await fn(db); } finally { release(); }
    },
  };
  return { db };
});
import { bookSandboxShipment, previewSandboxBooking, reconcileSandboxShipment } from '@/app/actions/sandbox-booking';

beforeEach(() => {
  state.role = 'admin'; state.failInsert = false; state.failResult = false; state.posts = 0;
  state.result = { status: 'booked', event: 'confirmed', externalOrderId: 'external' };
  vi.stubEnv('APP_ENV', 'test'); vi.stubEnv('BITESHIP_SANDBOX_BOOKING_ENABLED', 'true');
  vi.stubEnv('BITESHIP_SANDBOX_API_KEY', 'biteship_test.mock');
  state.tables = {
    orders: [{ id: 1, orderNumber: 'SBX-test', status: 'packing', total: '50000' }],
    invoices: [{ status: 'paid', amount: '50000' }],
    shippings: [{ recipientName: 'Test', phone: '08123', address: 'Test', latitude: '-6.3', longitude: '106.9', courierCompany: 'jne', courierType: 'reg' }],
    order_items: [{ productName: 'Test', quantity: 2, price: '25000', unitWeightGrams: 200 }],
    store_settings: Object.entries({ store_name: 'Test', store_phone: '08123', store_address: 'Test', store_latitude: '-6.2', store_longitude: '106.8' }).map(([key, value]) => ({ key, value })),
    couriers: [{ code: 'jne', isActive: true }],
  };
});
afterEach(() => vi.unstubAllEnvs());
async function reviewedHash() {
  const preview = await previewSandboxBooking(1);
  expect(preview.success).toBe(true);
  return preview.success ? preview.hash : '';
}
describe('admin sandbox booking action', () => {
  it('authorizes preview, booking and reconciliation on the server', async () => {
    state.role = 'customer';
    expect((await previewSandboxBooking(1)).success).toBe(false);
    expect((await bookSandboxShipment(1, '', true)).success).toBe(false);
    expect((await reconcileSandboxShipment(1, 'external')).success).toBe(false);
    expect(state.posts).toBe(0);
  });
  it.each(['orders', 'invoices', 'shippings', 'order_items'])('fails closed for missing %s', async table => {
    state.tables[table] = [];
    expect((await bookSandboxShipment(1, '', true)).success).toBe(false);
    expect(state.posts).toBe(0);
  });
  it('blocks old paid orders without historical weight', async () => {
    delete state.tables.order_items[0].unitWeightGrams;
    expect((await previewSandboxBooking(1)).success).toBe(false);
  });
  it('keeps checkout weight when the product master changes', async () => {
    const hash = await reviewedHash();
    state.tables.products = [{ id: 1, weight: 9000 }];
    expect(await reviewedHash()).toBe(hash);
    await bookSandboxShipment(1, hash, true);
    const snapshot = JSON.parse(state.tables.sandbox_bookings[0].snapshot);
    expect(snapshot.items[0]).toMatchObject({ weight: 200, quantity: 2, value: 25000 });
  });
  it('requires confirmation and rejects changed snapshots', async () => {
    const hash = await reviewedHash();
    expect((await bookSandboxShipment(1, hash, false)).success).toBe(false);
    state.tables.shippings[0].address = 'changed';
    expect((await bookSandboxShipment(1, hash, true)).success).toBe(false);
    expect(state.posts).toBe(0);
  });
  it('serializes double-clicks into one durable reservation and one POST', async () => {
    const hash = await reviewedHash();
    const results = await Promise.all([bookSandboxShipment(1, hash, true), bookSandboxShipment(1, hash, true)]);
    expect(results.filter(result => result.success)).toHaveLength(1);
    expect(state.posts).toBe(1);
    expect(state.tables.sandbox_bookings).toHaveLength(1);
    expect(state.tables.sandbox_bookings[0]).toMatchObject({ status: 'booked', mode: 'sandbox', externalOrderId: 'external' });
    expect(state.tables.orders[0].status).toBe('packing');
    expect(state.tables.shippings[0].trackingId).toBeUndefined();
  });
  it('never calls provider when unique reservation insert loses a race', async () => {
    const hash = await reviewedHash(); state.failInsert = true;
    expect((await bookSandboxShipment(1, hash, true)).success).toBe(false);
    expect(state.posts).toBe(0);
  });
  it('preserves reservation when response persistence fails after provider success', async () => {
    const hash = await reviewedHash(); state.failResult = true;
    expect((await bookSandboxShipment(1, hash, true)).success).toBe(false);
    state.failResult = false;
    expect(state.tables.sandbox_bookings[0].status).toBe('needs_reconciliation');
    expect((await bookSandboxShipment(1, hash, true)).success).toBe(false);
    expect((await reconcileSandboxShipment(1, 'external')).success).toBe(true);
    expect(state.posts).toBe(1);
  });
  it.each(['rejected', 'needs_reconciliation'])('never resends %s reservations', async status => {
    state.result = { status, event: 'unknown_outcome' };
    const hash = await reviewedHash();
    await bookSandboxShipment(1, hash, true);
    expect((await bookSandboxShipment(1, hash, true)).success).toBe(false);
    expect(state.posts).toBe(1);
  });
});
