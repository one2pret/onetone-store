// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type Connection, type Pool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import { commitOnlineOrderAtomically } from '@/lib/checkout/commit-online-order';
import { settleConfirmedSandboxCancellation } from '@/lib/checkout/process-sandbox-webhook';
import { handleSandboxInvoiceCallback } from '@/lib/checkout/handle-sandbox-invoice-callback';
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

  async function pendingInvoice(
    data: Awaited<ReturnType<typeof fixture>>,
    benefits: Parameters<typeof commitOnlineOrderAtomically>[0]['benefits'] = data.args.benefits,
    withLedger = true,
  ) {
    const order = await commitOnlineOrderAtomically({
      ...data.args, orderNumber: 'SBX-' + randomUUID().replaceAll('-', '').padStart(36, '0'),
      benefits,
    });
    const invoiceId = `sandbox-invoice-${order.orderId}`;
    const amount = String(order.total);
    await databaseClient.insert(schema.invoices).values({ orderId: order.orderId, xenditId: invoiceId, amount });
    if (withLedger) await databaseClient.insert(schema.checkoutPaymentAttempts).values({
      orderId: order.orderId, attemptNo: 1, mode: 'sandbox', externalId: order.orderNumber,
      requestHash: '0'.repeat(64), xenditId: invoiceId, amount, status: 'ready',
    });
    return {
      ...order,
      cancel: (paidAmount: number | null = null) => settleConfirmedSandboxCancellation({
        id: invoiceId, orderNumber: order.orderNumber, amount: order.total,
        status: 'EXPIRED', paidAmount, paymentMethod: null, paymentChannel: null,
      }),
      callback: (status: 'PAID' | 'EXPIRED' | 'CANCELLED', externalId = order.orderNumber) =>
        handleSandboxInvoiceCallback({ id: invoiceId, external_id: externalId, amount: order.total, status }),
    };
  }

  async function webhookState(data: Awaited<ReturnType<typeof fixture>>, orderId: number) {
    return {
      ...await state(data),
      invoices: await databaseClient.select().from(schema.invoices).where(eq(schema.invoices.orderId, orderId)),
      attempts: await databaseClient.select().from(schema.checkoutPaymentAttempts)
        .where(eq(schema.checkoutPaymentAttempts.orderId, orderId)),
      logs: await databaseClient.select().from(schema.orderStatusLogs).where(eq(schema.orderStatusLogs.orderId, orderId)),
    };
  }

  it.each([
    ['PAID', 'paid', 'EXPIRED', 'redeemed', 'packing', 2],
    ['EXPIRED', 'expired', 'PAID', 'available', 'expired', 3],
  ] as const)('settles %s once and preserves the terminal outcome on conflict', async (
    status, result, conflict, grantStatus, orderStatus, stock,
  ) => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    expect(await (await order.callback(status)).json()).toMatchObject({ result });
    const settled = await webhookState(data, order.orderId);
    expect(settled.grants).toMatchObject([{
      status: grantStatus, reservedOrderId: status === 'PAID' ? order.orderId : null,
      redeemedOrderId: status === 'PAID' ? order.orderId : null,
    }]);
    expect(settled.orders).toMatchObject([{ status: orderStatus }]);
    expect(settled.invoices).toMatchObject([{ status: result }]);
    expect(settled.attempts).toMatchObject([{ status: result }]);
    expect(settled.logs).toHaveLength(1);
    expect(settled.membership).toMatchObject([{ points: status === 'PAID' ? 10 : 20 }]);
    expect(settled.ledger.filter(row => row.reason === 'order_voucher_restore'))
      .toMatchObject(status === 'PAID' ? [] : [{ delta: 10, orderId: order.orderId }]);
    expect(settled.stock.map(row => row.quantity)).toEqual([stock, stock]);
    expect(await (await order.callback(status)).json()).toMatchObject({ result: 'duplicate' });
    expect(await (await order.callback(conflict)).json()).toMatchObject({ code: 'manual_reconciliation_required' });
    expect(await webhookState(data, order.orderId)).toEqual(settled);
  });

  it('serializes concurrent PAID and EXPIRED callbacks to one terminal result', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    const bodies = await Promise.all([order.callback('PAID'), order.callback('EXPIRED')])
      .then(responses => Promise.all(responses.map(response => response.json())));
    const settled = await webhookState(data, order.orderId);
    const paid = settled.invoices[0].status === 'paid';
    expect(bodies[paid ? 0 : 1]).toMatchObject({ result: paid ? 'paid' : 'expired' });
    expect(bodies[paid ? 1 : 0]).toMatchObject({ code: 'manual_reconciliation_required' });
    expect(settled.logs).toHaveLength(1);
    expect(settled.grants).toMatchObject([{ status: paid ? 'redeemed' : 'available' }]);
    expect(settled.movements.filter(row => row.type === 'return')).toHaveLength(paid ? 0 : 2);
  });

  it('preserves a newer reservation when the old EXPIRED callback is replayed', async () => {
    const data = await fixture();
    const first = await pendingInvoice(data);
    await first.callback('EXPIRED');
    await databaseClient.insert(schema.cartItems).values(data.productIds.map(productId => ({
      userId: data.id, productId,
    })));
    const second = await pendingInvoice(data);
    expect(await (await first.callback('EXPIRED')).json()).toMatchObject({ result: 'duplicate' });
    expect((await state(data)).grants).toMatchObject([{ status: 'reserved', reservedOrderId: second.orderId }]);
  });

  it('blocks wrong order, wrong owner, and inconsistent or missing reservations', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    const other = await fixture();
    const otherOrder = await pendingInvoice(other);
    const before = await webhookState(data, order.orderId);
    expect((await order.callback('PAID', otherOrder.orderNumber)).status).toBe(409);
    expect(await webhookState(data, order.orderId)).toEqual(before);

    const grant = eq(schema.userVouchers.id, data.id);
    const otherBefore = await webhookState(other, otherOrder.orderId);
    for (const patch of [
      { reservedOrderId: otherOrder.orderId },
      { userId: other.id },
      { userId: data.id, reservedOrderId: null },
    ]) {
      await databaseClient.update(schema.userVouchers).set(patch).where(grant);
      const inconsistent = await webhookState(data, order.orderId);
      const response = await order.callback('EXPIRED');
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: 'Voucher reservation requires reconciliation' });
      expect(await webhookState(data, order.orderId)).toEqual(inconsistent);
    }
    expect(await webhookState(other, otherOrder.orderId)).toEqual(otherBefore);
  });

  it.each(['campaign expiry', 'grant expiry', 'disabled campaign', 'tier change'] as const)(
    'does not return the grant to available after %s', async policy => {
      const data = await fixture({ tierId: 1 });
      const order = await pendingInvoice(data);
      const campaign = eq(schema.vouchers.id, data.id);
      const past = new Date(86_400_000);
      if (policy === 'campaign expiry') await databaseClient.update(schema.vouchers).set({ endsAt: past }).where(campaign);
      if (policy === 'disabled campaign') await databaseClient.update(schema.vouchers).set({ isActive: false }).where(campaign);
      if (policy === 'grant expiry') await databaseClient.update(schema.userVouchers).set({ expiresAt: past })
        .where(eq(schema.userVouchers.id, data.id));
      if (policy === 'tier change') await databaseClient.insert(schema.memberTiers).values({ id: data.id, name: 'Changed tier' })
        .then(() => databaseClient.update(schema.vouchers).set({ tierId: data.id }).where(campaign));
      expect(await (await order.callback('EXPIRED')).json()).toMatchObject({ result: 'expired' });
      expect((await state(data)).grants).toMatchObject([{ status: 'expired', reservedOrderId: null }]);
    },
  );

  it('honors the reserved discount on PAID after the grant expires', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    await databaseClient.update(schema.userVouchers).set({ expiresAt: new Date(86_400_000) })
      .where(eq(schema.userVouchers.id, data.id));
    expect(await (await order.callback('PAID')).json()).toMatchObject({ result: 'paid' });
    expect((await state(data)).grants).toMatchObject([{ status: 'redeemed', redeemedOrderId: order.orderId }]);
  });

  it.each(['PAID', 'EXPIRED', 'CANCELLED'] as const)('rolls back the full %s transaction on a late ledger DB failure', async status => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    const before = await webhookState(data, order.orderId);
    await admin.query(`CREATE TRIGGER reject_fixture_settlement BEFORE UPDATE ON checkout_payment_attempts
      FOR EACH ROW BEGIN IF NEW.order_id = ${order.orderId} THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture ledger failure';
      END IF; END`);
    try {
      if (status === 'CANCELLED') {
        await expect(order.cancel()).rejects.toThrow();
      } else {
        expect((await order.callback(status)).status).toBe(503);
      }
      expect(await webhookState(data, order.orderId)).toEqual(before);
    } finally {
      await admin.query('DROP TRIGGER reject_fixture_settlement');
    }
    if (status === 'CANCELLED') {
      expect(await order.cancel()).toMatchObject({ decision: 'cancelled' });
    } else {
      expect(await (await order.callback(status)).json()).toMatchObject({ result: status.toLowerCase() });
    }
  });

  it('cancels atomically, keeps an expired grant unavailable, and ignores terminal replays', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    await databaseClient.update(schema.userVouchers).set({ expiresAt: new Date(86_400_000) })
      .where(eq(schema.userVouchers.id, data.id));

    expect(await order.cancel()).toMatchObject({ decision: 'cancelled' });
    const cancelled = await webhookState(data, order.orderId);
    expect(cancelled.grants).toMatchObject([{ status: 'expired', reservedOrderId: null }]);
    expect(cancelled.orders).toMatchObject([{ status: 'cancelled', cancelledAt: expect.any(Date) }]);
    expect(cancelled.invoices).toMatchObject([{ status: 'cancelled', cancelledAt: expect.any(Date) }]);
    expect(cancelled.attempts).toMatchObject([{ status: 'expired' }]);
    expect(cancelled.logs).toMatchObject([{ toStatus: 'cancelled', changedBy: 'system:sandbox-cancellation' }]);
    expect(cancelled.stock.map(row => row.quantity)).toEqual([3, 3]);
    expect(cancelled.membership).toMatchObject([{ points: 20 }]);
    expect(cancelled.ledger.filter(row => row.reason === 'order_voucher_restore'))
      .toMatchObject([{ delta: 10, orderId: order.orderId }]);

    expect(await order.cancel()).toMatchObject({ decision: 'duplicate' });
    for (const event of ['PAID', 'EXPIRED'] as const) {
      expect(await (await order.callback(event)).json()).toMatchObject({ code: 'manual_reconciliation_required' });
    }
    expect(await webhookState(data, order.orderId)).toEqual(cancelled);
  });

  it('preserves PAID when cancellation evidence and EXPIRED arrive late', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    expect(await (await order.callback('PAID')).json()).toMatchObject({ result: 'paid' });
    const paid = await webhookState(data, order.orderId);
    expect(await order.cancel()).toMatchObject({ decision: 'conflict' });
    expect(await (await order.callback('EXPIRED')).json()).toMatchObject({ code: 'manual_reconciliation_required' });
    expect(await webhookState(data, order.orderId)).toEqual(paid);
  });

  it('serializes concurrent PAID and cancellation without duplicate refunds', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    const [paid, cancelled] = await Promise.all([
      order.callback('PAID').then(response => response.json()), order.cancel(),
    ]);
    const saved = await webhookState(data, order.orderId);
    expect(saved.logs).toHaveLength(1);
    if (saved.invoices[0].status === 'paid') {
      expect(paid).toMatchObject({ result: 'paid' });
      expect(cancelled).toMatchObject({ decision: 'conflict' });
      expect(saved.membership).toMatchObject([{ points: 10 }]);
      expect(saved.ledger.filter(row => row.reason === 'order_voucher_restore')).toHaveLength(0);
    } else {
      expect(paid).toMatchObject({ code: 'manual_reconciliation_required' });
      expect(cancelled).toMatchObject({ decision: 'cancelled' });
      expect(saved.membership).toMatchObject([{ points: 20 }]);
      expect(saved.ledger.filter(row => row.reason === 'order_voucher_restore')).toHaveLength(1);
    }
  });

  it.each(['missing debit', 'wrong debit', 'previous refund', 'wrong owner', 'missing grant'] as const)(
    'fails closed on cancellation with %s', async problem => {
      const data = await fixture();
      const order = await pendingInvoice(data);
      const ledger = eq(schema.pointsLedger.orderId, order.orderId);
      const grant = eq(schema.userVouchers.id, data.id);
      if (problem === 'missing debit') await databaseClient.delete(schema.pointsLedger).where(ledger);
      if (problem === 'wrong debit') await databaseClient.update(schema.pointsLedger).set({ delta: -9 }).where(ledger);
      if (problem === 'previous refund') await databaseClient.insert(schema.pointsLedger).values({
        membershipId: data.id, orderId: order.orderId, delta: 10, reason: 'order_expire_restore',
      });
      if (problem === 'wrong owner') {
        const other = await fixture();
        await databaseClient.update(schema.userVouchers).set({ userId: other.id }).where(grant);
      }
      if (problem === 'missing grant') await databaseClient.delete(schema.userVouchers).where(grant);
      const before = await webhookState(data, order.orderId);
      await expect(order.cancel()).rejects.toMatchObject({ status: 503 });
      expect(await webhookState(data, order.orderId)).toEqual(before);
    },
  );

  it('cancels without crediting points when there was no debit', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data, { ...data.args.benefits, pointsToRedeem: 0 });
    expect(await order.cancel()).toMatchObject({ decision: 'cancelled' });
    const saved = await webhookState(data, order.orderId);
    expect(saved.membership).toMatchObject([{ points: 20 }]);
    expect(saved.ledger).toHaveLength(0);
  });

  it('rejects cancellation evidence that reports a payment', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    const before = await webhookState(data, order.orderId);
    expect(() => order.cancel(100)).toThrow('requires confirmed invoice expiry');
    expect(await webhookState(data, order.orderId)).toEqual(before);
  });

  it('requires a payment attempt before applying cancellation', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data, data.args.benefits, false);
    const before = await webhookState(data, order.orderId);
    await expect(order.cancel()).rejects.toMatchObject({ status: 409 });
    expect(await webhookState(data, order.orderId)).toEqual(before);
  });

  it('keeps a voucher reservation intact on an unsupported CANCELLED callback', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data);
    const before = await webhookState(data, order.orderId);
    expect(await (await order.callback('CANCELLED')).json()).toMatchObject({
      message: 'Unsupported sandbox invoice status ignored',
    });
    expect(await webhookState(data, order.orderId)).toEqual(before);
  });

  it('preserves the existing membership-only EXPIRED behavior', async () => {
    const data = await fixture();
    const order = await pendingInvoice(data, { kind: 'membership-points-v1', pointsToRedeem: 10 }, false);
    const before = await webhookState(data, order.orderId);
    expect(await (await order.callback('EXPIRED')).json()).toMatchObject({ result: 'expired' });
    const settled = await webhookState(data, order.orderId);
    expect(settled.grants).toEqual(before.grants);
    expect(settled.membership).toEqual(before.membership);
    expect(settled.ledger).toEqual(before.ledger);
    expect(settled.stock.map(row => row.quantity)).toEqual([3, 3]);
  });

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
