// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type Connection, type Pool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import { commitOnlineOrderAtomically } from '@/lib/checkout/commit-online-order';
import { checkoutSnapshotDigest } from '@/lib/checkout/order-snapshot';

vi.mock('@/lib/db', () => ({
  get db() { return databaseClient; },
}));

const url = process.env.SANDBOX_BOOKING_TEST_DATABASE_URL;
const database = 'sbx_voucher_' + randomUUID().replaceAll('-', '');
let admin: Connection;
let pool: Pool;
let databaseClient: ReturnType<typeof connect>;
let created = false;

function connect(pool: Pool) {
  return drizzle(pool, { schema, mode: 'default' });
}

describe.skipIf(!url)('atomic voucher checkout on disposable MySQL', () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/sbx_booking_test') {
      throw new Error('Dedicated local sbx_booking_test required');
    }
    const options = { host: parsed.hostname, port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password), timezone: 'Z' };
    admin = await mysql.createConnection(options);
    await admin.query('CREATE DATABASE ??', [database]);
    created = true;
    await admin.changeUser({ database });
    // drizzle-kit 0.30 bundles CommonJS dependencies in its ESM entry.
    const { generateMySQLDrizzleJson, generateMySQLMigration } =
      createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api');
    const empty = await generateMySQLDrizzleJson({});
    const current = await generateMySQLDrizzleJson(schema);
    for (const statement of await generateMySQLMigration(empty, current)) {
      await admin.query(statement);
    }
    pool = mysql.createPool({ ...options, database, connectionLimit: 4 });
    databaseClient = connect(pool);
    await databaseClient.insert(schema.inventoryLocations).values({
      id: 1, code: 'TEST', name: 'Test', type: 'online', isOnlineDefault: true,
    });
    await databaseClient.insert(schema.memberTiers).values({ id: 1, name: 'Test' });
  }, 30000);

  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query('DROP DATABASE ??', [database]);
    await admin?.end();
  });

  let nextId = 10;
  async function fixture(policy: Partial<typeof schema.vouchers.$inferInsert> = {}, owned = true) {
    const id = nextId;
    nextId += 2;
    const db = databaseClient;
    await db.insert(schema.users).values({ id, name: 'Test', email: `test-${id}@example.test`, password: 'fixture' });
    const address = { id, userId: id, recipientName: 'Test', phone: '0000000000',
      address: 'Test address', detail: null, latitude: null, longitude: null };
    await db.insert(schema.addresses).values({ ...address, province: 'Test', city: 'Test',
      district: 'Test', postalCode: '00000' });
    const productIds = [id, id + 1];
    await db.insert(schema.products).values(productIds.map(productId => ({
      id: productId, name: 'Test item', slug: `test-item-${productId}`, price: '10000', stock: 3, weight: 100,
    })));
    await db.insert(schema.cartItems).values(productIds.map(productId => ({ userId: id, productId })));
    await db.insert(schema.inventoryBalances).values(productIds.map(productId => ({
      locationId: 1, productId, quantity: 3,
    })));
    await db.insert(schema.memberships).values({ id, userId: id, tierId: 1, points: 20 });
    await db.insert(schema.vouchers).values({ id, code: `TEST-${id}`, type: 'fixed', value: 5000,
      minSpend: 10000, audience: 'new_user', ...policy });
    if (owned) await db.insert(schema.userVouchers).values({ id, userId: id, voucherId: id });
    const args = {
      userId: id, addressId: id, orderNumber: `TEST-${id}`,
      snapshot: checkoutSnapshotDigest({ address, items: productIds.map(productId => ({
        productId, variantId: null, quantity: 1, unitWeight: 100, unitPrice: 10000,
      })) }),
      shipping: { courierName: 'Test', courierCompany: 'test', courierType: 'reg', price: 2000 },
      benefits: { kind: 'voucher-membership-v1' as const, voucherId: id, pointsToRedeem: 10 },
    };
    return { id, productIds, args };
  }

  async function state({ id, productIds }: Awaited<ReturnType<typeof fixture>>) {
    const db = databaseClient;
    return {
      orderItems: await db.select().from(schema.orderItems).where(inArray(schema.orderItems.productId, productIds)),
      shipments: await db.select().from(schema.shippings).innerJoin(schema.orders, eq(schema.shippings.orderId, schema.orders.id)).where(eq(schema.orders.userId, id)),
      orders: await db.select().from(schema.orders).where(eq(schema.orders.userId, id)),
      grants: await db.select().from(schema.userVouchers).where(eq(schema.userVouchers.userId, id)),
      membership: await db.select().from(schema.memberships).where(eq(schema.memberships.userId, id)),
      ledger: await db.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.membershipId, id)),
      cart: await db.select().from(schema.cartItems).where(eq(schema.cartItems.userId, id)),
      products: await db.select().from(schema.products).where(inArray(schema.products.id, productIds)),
      stock: await db.select().from(schema.inventoryBalances).where(inArray(schema.inventoryBalances.productId, productIds)),
      movements: await db.select().from(schema.inventoryMovements).where(inArray(schema.inventoryMovements.productId, productIds)),
    };
  }

  it('persists the server discount, reserves once, debits points and clears the cart', async () => {
    const data = await fixture({ tierId: 1 });
    const result = await commitOnlineOrderAtomically(data.args);
    const retry = await commitOnlineOrderAtomically(data.args);
    expect(result).toMatchObject({ created: true, total: 16000 });
    expect(retry).toEqual({ ...result, created: false });
    const saved = await state(data);
    expect(saved.orders).toMatchObject([{ voucherId: data.id, discountAmount: '5000.00', pointsRedeemed: 10 }]);
    expect(saved.grants).toMatchObject([{ status: 'reserved', reservedOrderId: result.orderId }]);
    expect(saved.membership).toMatchObject([{ points: 10 }]);
    expect(saved.ledger).toMatchObject([{ orderId: result.orderId, delta: -10 }]);
    expect(saved.stock.map(row => row.quantity)).toEqual([2, 2]);
    expect(saved.movements).toHaveLength(2);
    expect(saved.cart).toHaveLength(0);
  });

  it.each([
    ['missing ownership', {}, false, 'tidak dimiliki'],
    ['expired campaign', { endsAt: new Date(86_400_000) }, true, 'tidak tersedia'],
    ['insufficient subtotal', { minSpend: 20001 }, true, 'tidak tersedia'],
    ['limited quota', { quota: 1 }, true, 'belum didukung'],
    ['first order only', { firstOrderOnly: true }, true, 'belum didukung'],
    ['multiple uses', { maxUsesPerUser: 2 }, true, 'belum didukung'],
    ['missing grant expiry', { validDaysAfterGrant: 30 }, true, 'kedaluwarsa'],
    ['membership voucher', { audience: 'membership' }, true, 'belum didukung'],
    ['public voucher', { audience: 'public' }, true, 'belum didukung'],
    ['points stacking forbidden', { allowPoints: false }, true, 'voucher_points_conflict'],
  ] as const)('leaves all state unchanged for %s', async (_, policy, owned, message) => {
    const data = await fixture(policy, owned);
    const before = await state(data);
    await expect(commitOnlineOrderAtomically(data.args)).rejects.toThrow(message);
    expect(await state(data)).toEqual(before);
  });

  it('rejects an expired owned grant on an active campaign', async () => {
    const data = await fixture({ validDaysAfterGrant: 30 });
    await databaseClient.update(schema.userVouchers).set({ expiresAt: new Date(86_400_000) })
      .where(eq(schema.userVouchers.id, data.id));
    const before = await state(data);
    await expect(commitOnlineOrderAtomically(data.args)).rejects.toThrow('kedaluwarsa');
    expect(await state(data)).toEqual(before);
  });

  it.each([
    [undefined, 22000, 20],
    [{ kind: 'membership-points-v1', pointsToRedeem: 10 } as const, 21000, 10],
  ])('preserves non-voucher checkout for %j', async (benefits, total, points) => {
    const data = await fixture();
    const result = await commitOnlineOrderAtomically({ ...data.args, benefits });
    expect(result.total).toBe(total);
    const saved = await state(data);
    expect(saved.orders).toMatchObject([{ voucherId: null, discountAmount: '0.00' }]);
    expect(saved.grants).toMatchObject([{ status: 'available', reservedOrderId: null }]);
    expect(saved.membership).toMatchObject([{ points }]);
  });

  it('rolls back order, grant, points and an earlier stock update when a later item is out of stock', async () => {
    const data = await fixture();
    await databaseClient.update(schema.inventoryBalances).set({ quantity: 0 })
      .where(eq(schema.inventoryBalances.productId, data.productIds[1]));
    const before = await state(data);
    await expect(commitOnlineOrderAtomically(data.args)).rejects.toThrow('Stok Gudang Online');
    expect(await state(data)).toEqual(before);
  });

  it('allows one competing checkout and rejects reuse even after the cart is refilled', async () => {
    const data = await fixture();
    const alternate = { ...data.args, orderNumber: `${data.args.orderNumber}-alternate` };
    const results = await Promise.allSettled([
      commitOnlineOrderAtomically(data.args), commitOnlineOrderAtomically(alternate),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    await databaseClient.insert(schema.cartItems).values(data.productIds.map(productId => ({
      userId: data.id, productId,
    })));
    const before = await state(data);
    expect(before.orders).toHaveLength(1);
    await expect(commitOnlineOrderAtomically({
      ...data.args, orderNumber: `${data.args.orderNumber}-reuse`,
    })).rejects.toThrow('sudah digunakan');
    expect(await state(data)).toEqual(before);
  });
});
