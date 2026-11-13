// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql, { type Connection, type Pool, type RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.SANDBOX_BOOKING_TEST_DATABASE_URL;
const database = `sbx_booking_test_${randomUUID().replaceAll('-', '')}`;
let admin: Connection;
let pool: Pool;
let created = false;
describe.skipIf(!url)('booking migration and reservation on MySQL', () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/sbx_booking_test') {
      throw new Error('Dedicated local sbx_booking_test database required');
    }
    const options = { host: parsed.hostname, port: Number(parsed.port || 3306), user: parsed.username, password: decodeURIComponent(parsed.password) };
    admin = await mysql.createConnection(options);
    await admin.query('CREATE DATABASE ??', [database]); created = true;
    await admin.changeUser({ database });
    await admin.query('CREATE TABLE orders (id INT PRIMARY KEY)');
    await admin.query('CREATE TABLE order_items (id INT PRIMARY KEY, order_id INT, quantity INT, price DECIMAL(12,2))');
    await admin.query('INSERT INTO orders VALUES (1),(2),(3)');
    await admin.query('INSERT INTO order_items VALUES (1,1,2,25000)');
    const sql = await readFile('lib/db/migrations/0018_sandbox_bookings.sql', 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) await admin.query(statement);
    pool = mysql.createPool({ ...options, database, connectionLimit: 4 });
  }, 30000);
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query('DROP DATABASE ??', [database]);
    await admin?.end();
  });
  it('preserves old data with null weight; never backfills from master', async () => {
    const [rows] = await admin.query<RowDataPacket[]>('SELECT * FROM order_items');
    expect(rows[0]).toMatchObject({ quantity: 2, price: '25000.00', unit_weight_grams: null });
  });
  it('allows one winner under concurrent unique reservation inserts', async () => {
    const reserve = async () => {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query("INSERT INTO sandbox_bookings (order_id,reference_id,booking_status,snapshot,snapshot_hash) VALUES (1,'onetone-sbx-SBX-race','needs_reconciliation','{}',?)", ['a'.repeat(64)]);
        await connection.commit(); return 'committed';
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    };
    const results = await Promise.allSettled([reserve(), reserve()]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason.code).toBe('ER_DUP_ENTRY');
    const [rows] = await admin.query<RowDataPacket[]>('SELECT * FROM sandbox_bookings');
    expect(rows).toHaveLength(1);
    expect(rows[0].booking_status).toBe('needs_reconciliation');
  });
  it('enforces reference uniqueness across different orders', async () => {
    await expect(admin.query("INSERT INTO sandbox_bookings (order_id,reference_id,booking_status,snapshot,snapshot_hash) VALUES (2,'onetone-sbx-SBX-race','needs_reconciliation','{}',?)", ['b'.repeat(64)]))
      .rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });
  it('rolls back an uncommitted reservation and its audit event together', async () => {
    await admin.beginTransaction();
    await admin.query("INSERT INTO sandbox_bookings (order_id,reference_id,booking_status,snapshot,snapshot_hash) VALUES (3,'onetone-sbx-SBX-rollback','needs_reconciliation','{}',?)", ['c'.repeat(64)]);
    await admin.query("INSERT INTO sandbox_booking_events (booking_id,actor_id,event) VALUES (LAST_INSERT_ID(),1,'reserved_admin_confirmed')");
    await admin.rollback();
    const [rows] = await admin.query<RowDataPacket[]>('SELECT * FROM sandbox_bookings WHERE order_id=3');
    const [events] = await admin.query<RowDataPacket[]>('SELECT * FROM sandbox_booking_events');
    expect(rows).toHaveLength(0); expect(events).toHaveLength(0);
  });
});
