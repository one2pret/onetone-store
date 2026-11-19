// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const url = process.env.SANDBOX_BOOKING_TEST_DATABASE_URL;
const database = 'checkout_attempt_test_' + randomUUID().replaceAll('-', '');
let admin: Connection;
let created = false;

describe.skipIf(!url)('payment attempt schema and uniqueness on isolated MySQL 8', () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) ||
        parsed.pathname !== '/sbx_booking_test') {
      throw new Error('Dedicated LOCAL MySQL test URL required');
    }
    admin = await mysql.createConnection({
      host: parsed.hostname, port: Number(parsed.port || 3306),
      user: parsed.username, password: decodeURIComponent(parsed.password),
    });
    await admin.query('CREATE DATABASE ??', [database]);
    created = true;
    await admin.changeUser({ database });
    await admin.query('CREATE TABLE orders (id INT PRIMARY KEY)');
    await admin.query('INSERT INTO orders VALUES (1), (2)');
    const sql = await readFile('lib/db/migrations/0019_checkout_payment_attempts.sql', 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await admin.query(statement);
    }
  }, 30000);

  afterAll(async () => {
    if (admin && created) {
      await admin.query('DROP DATABASE ??', [database]);
      created = false;
    }
    await admin?.end();
  });

  it('reserves a durable entry before any outbound provider request', async () => {
    await admin.query(
      `INSERT INTO checkout_payment_attempts
        (order_id, attempt_no, mode, external_id, request_hash, amount)
        VALUES (1, 1, 'sandbox', 'SBX-order-1-try-1', ?, 50000)`,
      ['a'.repeat(64)],
    );
    const [rows] = await admin.query<RowDataPacket[]>(
      'SELECT status, mode, amount, xendit_id FROM checkout_payment_attempts WHERE order_id=1',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('reserved');
    expect(rows[0].mode).toBe('sandbox');
    expect(rows[0].xendit_id).toBeNull();
  });

  it('prevents a duplicate order attempt or duplicate provider reference', async () => {
    await expect(admin.query(
      `INSERT INTO checkout_payment_attempts
        (order_id, attempt_no, mode, external_id, request_hash, amount)
        VALUES (1, 1, 'sandbox', 'SBX-another-reference', ?, 50000)`,
      ['b'.repeat(64)],
    )).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    await expect(admin.query(
      `INSERT INTO checkout_payment_attempts
        (order_id, attempt_no, mode, external_id, request_hash, amount)
        VALUES (2, 1, 'sandbox', 'SBX-order-1-try-1', ?, 50000)`,
      ['b'.repeat(64)],
    )).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  it('permits a second attempt identifier only as a distinct stored record', async () => {
    await admin.query(
      `INSERT INTO checkout_payment_attempts
        (order_id, attempt_no, mode, external_id, request_hash, amount)
        VALUES (1, 2, 'sandbox', 'SBX-order-1-try-2', ?, 50000)`,
      ['a'.repeat(64)],
    );
    const [rows] = await admin.query<RowDataPacket[]>(
      'SELECT attempt_no, status FROM checkout_payment_attempts WHERE order_id=1 ORDER BY attempt_no',
    );
    expect(rows.map(row => row.attempt_no)).toEqual([1, 2]);
    expect(rows.every(row => row.status === 'reserved')).toBe(true);
  });

  it('enforces unique provider invoice ID when later attached', async () => {
    await admin.query(
      `UPDATE checkout_payment_attempts SET xendit_id='invoice_test_1'
       WHERE order_id=1 AND attempt_no=1`,
    );
    await expect(admin.query(
      `UPDATE checkout_payment_attempts SET xendit_id='invoice_test_1'
       WHERE order_id=1 AND attempt_no=2`,
    )).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  it('keeps order and amount constraints enforced by the database', async () => {
    await expect(admin.query(
      `INSERT INTO checkout_payment_attempts
        (order_id, attempt_no, mode, external_id, request_hash, amount)
        VALUES (999, 1, 'sandbox', 'SBX-foreign-order', ?, 50000)`,
      ['d'.repeat(64)],
    )).rejects.toMatchObject({ code: 'ER_NO_REFERENCED_ROW_2' });
    await expect(admin.query(
      `INSERT INTO checkout_payment_attempts
        (order_id, attempt_no, mode, external_id, request_hash, amount)
        VALUES (1, 0, 'sandbox', 'SBX-zero-attempt', ?, 50000)`,
      ['d'.repeat(64)],
    )).rejects.toMatchObject({ code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
    await expect(admin.query(
      `INSERT INTO checkout_payment_attempts
        (order_id, attempt_no, mode, external_id, request_hash, amount)
        VALUES (1, 3, 'sandbox', 'SBX-zero-amount', ?, 0)`,
      ['d'.repeat(64)],
    )).rejects.toMatchObject({ code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
  });
});
