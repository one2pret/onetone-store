// @vitest-environment node
// Isolated, disposable LOCAL MySQL database; never reaches a real provider.
import { randomUUID } from 'node:crypto';
import mysql, { type Connection, type Pool, type RowDataPacket } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '@/lib/db/schema';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

const url = process.env.SANDBOX_BOOKING_TEST_DATABASE_URL;
const database = 'sbx_ledger_runtime_' + randomUUID().replaceAll('-', '');
let admin: Connection;
let pool: Pool;
let store: typeof import('@/lib/checkout/sandbox-payment-attempt-store');
let created = false;

const orderOne = { orderId: 1, userId: 7, orderNumber: 'SBX-' + '1'.repeat(36), amount: 50000, requestHash: 'a'.repeat(64) };
const orderTwo = { orderId: 2, userId: 7, orderNumber: 'SBX-' + '2'.repeat(36), amount: 60000, requestHash: 'b'.repeat(64) };
const orderThree = { orderId: 3, userId: 7, orderNumber: 'SBX-' + '3'.repeat(36), amount: 70000, requestHash: 'c'.repeat(64) };

describe.skipIf(!url)('Xendit TEST ledger runtime on isolated MySQL (no Xendit network)', () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) ||
        parsed.pathname !== '/sbx_booking_test') {
      throw new Error('Dedicated LOCAL MySQL sbx_booking_test URL required');
    }
    const connection = {
      host: parsed.hostname, port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
    admin = await mysql.createConnection(connection);
    await admin.query('CREATE DATABASE ??', [database]);
    created = true;
    await admin.changeUser({ database });

    // Only columns read/written by the runtime repository are required.
    await admin.query(`CREATE TABLE orders (
      id INT PRIMARY KEY, user_id INT NOT NULL, order_number VARCHAR(50) NOT NULL,
      order_channel ENUM('online','pos') NOT NULL,
      status ENUM('waiting_payment','packing','expired','cancelled') NOT NULL,
      total DECIMAL(12,2) NOT NULL
    )`);
    // Drizzle INSERT emits nullable invoice fields as DEFAULT, so mirror
    // all columns the actual production schema declares (not only the subset
    // that this repository explicitly populates).
    await admin.query(`CREATE TABLE invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      xendit_id VARCHAR(255) UNIQUE,
      invoice_url TEXT,
      payment_method VARCHAR(100) NULL,
      payment_channel VARCHAR(100) NULL,
      amount DECIMAL(12,2) NOT NULL,
      status ENUM('pending','paid','expired','cancelled') DEFAULT 'pending',
      expired_at TIMESTAMP NULL,
      paid_at TIMESTAMP NULL,
      cancelled_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`INSERT INTO orders
      (id,user_id,order_number,order_channel,status,total)
      VALUES
      (1,7,?,'online','waiting_payment',50000),
      (2,7,?,'online','waiting_payment',60000),
      (3,7,?,'online','waiting_payment',70000)`, [
      orderOne.orderNumber, orderTwo.orderNumber, orderThree.orderNumber,
    ]);
    const migration = await readFile('lib/db/migrations/0019_checkout_payment_attempts.sql', 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await admin.query(statement);
    }

    pool = mysql.createPool({ ...connection, database, connectionLimit: 5 });
    // Load the REAL Drizzle store against a disposable DB, not the app DB.
    vi.doMock('@/lib/db', () => ({
      db: drizzle(pool, { schema, mode: 'default' }),
    }));
    store = await import('@/lib/checkout/sandbox-payment-attempt-store');
  }, 30000);

  afterAll(async () => {
    vi.doUnmock('@/lib/db');
    if (pool) await pool.end();
    if (admin && created) await admin.query('DROP DATABASE ??', [database]);
    if (admin) await admin.end();
  });

  it('allows exactly ONE claimed invoice attempt under two concurrent checkouts', async () => {
    const [a, b] = await Promise.all([
      store.reserveAndClaimSandboxAttempt(orderOne),
      store.reserveAndClaimSandboxAttempt(orderOne),
    ]);
    expect([a.kind, b.kind].sort()).toEqual(['claimed', 'pending']);
    const [rows] = await admin.query<RowDataPacket[]>(
      'SELECT attempt_no,status,mode,external_id FROM checkout_payment_attempts WHERE order_id=1',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      attempt_no: 1, status: 'requesting', mode: 'sandbox',
      external_id: orderOne.orderNumber,
    });
  });

  it('writes a ready invoice and ledger status together after a provider result', async () => {
    const [row] = await admin.query<RowDataPacket[]>(
      'SELECT id FROM checkout_payment_attempts WHERE order_id=1',
    );
    await store.persistReadySandboxInvoice({
      attemptId: row[0].id, orderId: 1,
      externalId: orderOne.orderNumber, amount: 50000,
      xenditId: 'xendit_TEST_1',
      invoiceUrl: 'https://test.example.invalid/invoice/1',
      expiredAt: new Date(Date.now() + 86_400_000),
    });
    const [invoice] = await admin.query<RowDataPacket[]>(
      'SELECT order_id,xendit_id FROM invoices WHERE order_id=1',
    );
    const [attempt] = await admin.query<RowDataPacket[]>(
      'SELECT status,xendit_id FROM checkout_payment_attempts WHERE order_id=1',
    );
    expect(invoice).toHaveLength(1);
    expect(attempt[0]).toMatchObject({ status: 'ready', xendit_id: 'xendit_TEST_1' });
    expect((await store.reserveAndClaimSandboxAttempt(orderOne)).kind).toBe('pending');
  });

  it('keeps unknown provider outcomes non-replayable after timeout', async () => {
    const claimed = await store.reserveAndClaimSandboxAttempt(orderTwo);
    expect(claimed.kind).toBe('claimed');
    if (claimed.kind !== 'claimed') throw new Error('Unexpected claim');
    await store.markSandboxAttemptNeedsReconciliation(claimed.attemptId);
    expect((await store.reserveAndClaimSandboxAttempt(orderTwo)).kind).toBe('pending');
    const [rows] = await admin.query<RowDataPacket[]>(
      'SELECT status FROM checkout_payment_attempts WHERE order_id=2',
    );
    expect(rows[0].status).toBe('needs_reconciliation');
  });

  it('rejects a different customer or wrong total without reserving a provider attempt', async () => {
    await expect(store.reserveAndClaimSandboxAttempt({ ...orderThree, userId: 8 }))
      .rejects.toThrow('not eligible');
    await expect(store.reserveAndClaimSandboxAttempt({ ...orderThree, amount: 71000 }))
      .rejects.toThrow('not eligible');
    const [rows] = await admin.query<RowDataPacket[]>(
      'SELECT id FROM checkout_payment_attempts WHERE order_id=3',
    );
    expect(rows).toHaveLength(0);
  });

  it('rolls back invoice insert and ledger transition together on persistence error', async () => {
    const claimed = await store.reserveAndClaimSandboxAttempt(orderThree);
    expect(claimed.kind).toBe('claimed');
    if (claimed.kind !== 'claimed') throw new Error('Unexpected claim');

    // Provider response contains an invoice id already used by order #1.
    // The insert fails and the transaction must not mark the attempt ready.
    await expect(store.persistReadySandboxInvoice({
      attemptId: claimed.attemptId, orderId: 3,
      externalId: orderThree.orderNumber, amount: 70000,
      xenditId: 'xendit_TEST_1',
      invoiceUrl: 'https://test.example.invalid/invoice/3',
      expiredAt: new Date(Date.now() + 86_400_000),
    })).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });

    const [invoices] = await admin.query<RowDataPacket[]>(
      'SELECT id FROM invoices WHERE order_id=3',
    );
    const [attempts] = await admin.query<RowDataPacket[]>(
      'SELECT status FROM checkout_payment_attempts WHERE order_id=3',
    );
    expect(invoices).toHaveLength(0);
    expect(attempts[0].status).toBe('requesting');
    await store.markSandboxAttemptNeedsReconciliation(claimed.attemptId);
    expect((await store.reserveAndClaimSandboxAttempt(orderThree)).kind).toBe('pending');
  });
});
