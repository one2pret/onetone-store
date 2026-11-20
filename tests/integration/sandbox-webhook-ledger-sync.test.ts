// @vitest-environment node
// Exercises the REAL webhook processor with MySQL transactions and NO provider calls.
// Test DB is a disposable local schema, never the deployed staging/production DB.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql, { type Connection, type Pool, type RowDataPacket } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '@/lib/db/schema';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const url = process.env.SANDBOX_BOOKING_TEST_DATABASE_URL;
const database = 'sbx_webhook_ledger_' + randomUUID().replaceAll('-', '');
let admin: Connection;
let pool: Pool;
let processEvent: typeof import('@/lib/checkout/process-sandbox-webhook').processSandboxInvoiceEvent;
let created = false;

const orderNumber = (n: number) => 'SBX-' + String(n).repeat(36);
const event = (n: number, status: 'PAID' | 'EXPIRED') => ({
  id: 'invoice_test_' + n,
  orderNumber: orderNumber(n),
  status,
  amount: 100000 + n,
  paidAmount: status === 'PAID' ? 100000 + n : null,
  paymentMethod: status === 'PAID' ? 'TEST' : null,
  paymentChannel: null,
});

describe.skipIf(!url)('sandbox Xendit webhook + ledger atomic transitions on local MySQL 8', () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) ||
        parsed.pathname !== '/sbx_booking_test') {
      throw new Error('Local disposable sbx_booking_test database URL required');
    }
    const opts = {
      host: parsed.hostname, port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
    admin = await mysql.createConnection(opts);
    await admin.query('CREATE DATABASE ??', [database]);
    created = true;
    await admin.changeUser({ database });
    // Full selected column sets mirror the real Drizzle schema (no real data).
    await admin.query(`CREATE TABLE orders (
      id INT PRIMARY KEY, user_id INT NULL, pos_customer_lead_id INT NULL,
      store_id INT NULL, voucher_id INT NULL,
      order_number VARCHAR(50) NOT NULL UNIQUE,
      order_channel ENUM('online','pos') DEFAULT 'online',
      status ENUM('waiting_payment','packing','shipping','delivered','expired','cancelled') DEFAULT 'waiting_payment',
      subtotal DECIMAL(12,2) NOT NULL,
      discount_amount DECIMAL(12,2) DEFAULT 0,
      shipping_cost DECIMAL(12,2) DEFAULT 0,
      total DECIMAL(12,2) NOT NULL,
      points_earned INT DEFAULT 0, points_redeemed INT DEFAULT 0,
      shipping_address TEXT NULL, shipping_phone VARCHAR(20) NULL,
      shipping_name VARCHAR(255) NULL, notes TEXT NULL,
      pos_session_id INT NULL,
      pos_payment_method ENUM('cash','qris','transfer') NULL,
      cash_received DECIMAL(12,2) NULL, cash_change DECIMAL(12,2) NULL,
      will_expired_at TIMESTAMP NULL, paid_at TIMESTAMP NULL,
      shipping_at TIMESTAMP NULL, delivered_at TIMESTAMP NULL,
      expired_at TIMESTAMP NULL, cancelled_at TIMESTAMP NULL,
      affiliate_id INT NULL, affiliate_code VARCHAR(32) NULL,
      affiliate_link_id INT NULL, affiliate_click_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE invoices (
      id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL,
      xendit_id VARCHAR(255) UNIQUE,
      invoice_url TEXT NULL, payment_method VARCHAR(100) NULL,
      payment_channel VARCHAR(100) NULL, amount DECIMAL(12,2) NOT NULL,
      invoice_status ENUM('pending','paid','expired','cancelled') DEFAULT 'pending',
      expired_at TIMESTAMP NULL, paid_at TIMESTAMP NULL,
      cancelled_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE order_items (
      id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL,
      product_id INT NULL, variant_id INT NULL,
      product_name VARCHAR(255) NOT NULL, product_image VARCHAR(500) NULL,
      variant_label VARCHAR(100) NULL, price DECIMAL(12,2) NOT NULL,
      regular_price DECIMAL(12,2) NULL,
      product_discount_amount DECIMAL(12,2) DEFAULT 0,
      manual_discount_amount DECIMAL(12,2) DEFAULT 0,
      unit_weight_grams INT NULL, quantity INT NOT NULL,
      subtotal DECIMAL(12,2) NOT NULL
    )`);
    await admin.query(`CREATE TABLE inventory_movements (
      id INT AUTO_INCREMENT PRIMARY KEY, location_id INT NOT NULL,
      product_id INT NOT NULL, variant_id INT NULL,
      quantity_delta INT NOT NULL, balance_after INT NOT NULL,
      type ENUM('opening_balance','receipt','online_sale','pos_sale','return','transfer_in','transfer_out','adjustment') NOT NULL,
      reference_type VARCHAR(50) NULL, reference_id INT NULL,
      actor_user_id INT NULL, notes VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE inventory_balances (
      id INT AUTO_INCREMENT PRIMARY KEY, location_id INT NOT NULL,
      product_id INT NOT NULL, variant_id INT NULL,
      quantity INT DEFAULT 0 NOT NULL, reserved INT DEFAULT 0 NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await admin.query(`CREATE TABLE products (
      id INT PRIMARY KEY, stock INT DEFAULT 0
    )`);
    await admin.query(`CREATE TABLE order_status_logs (
      id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL,
      from_status VARCHAR(50) NOT NULL, to_status VARCHAR(50) NOT NULL,
      changed_by VARCHAR(100) NOT NULL, note TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    const migration = await readFile('lib/db/migrations/0019_checkout_payment_attempts.sql', 'utf8');
    for (const stmt of migration.split('--> statement-breakpoint')) {
      if (stmt.trim()) await admin.query(stmt);
    }

    for (let n = 1; n <= 6; n++) {
      await admin.query(
        `INSERT INTO orders
          (id,order_number,order_channel,status,subtotal,total)
          VALUES (?,?,'online',?,?,?)`,
        [n, orderNumber(n), n === 4 ? 'packing' : 'waiting_payment',
          100000 + n, 100000 + n],
      );
      await admin.query(
        `INSERT INTO invoices (order_id,xendit_id,amount,invoice_status)
          VALUES (?,?,?,?)`,
        [n, 'invoice_test_' + n, 100000 + n, n === 4 ? 'paid' : 'pending'],
      );
      if (n !== 3) {
        await admin.query(
          `INSERT INTO checkout_payment_attempts
           (order_id,attempt_no,mode,external_id,request_hash,amount,status,xendit_id)
           VALUES (?,1,'sandbox',?,?,?,'ready',?)`,
          [n, orderNumber(n), 'a'.repeat(64), 100000 + n,
            n === 5 ? 'wrong_provider_invoice_id' : 'invoice_test_' + n],
        );
      }
    }
    await admin.query("INSERT INTO products (id,stock) VALUES (10,4)");
    await admin.query("INSERT INTO inventory_balances (location_id,product_id,quantity,reserved) VALUES (1,10,4,0)");
    for (const n of [1, 2, 4, 6]) {
      await admin.query(
        `INSERT INTO order_items
          (order_id,product_id,product_name,price,quantity,subtotal)
          VALUES (?,10,'sandbox item',?,1,?)`,
        [n, 100000 + n, 100000 + n],
      );
      await admin.query(
        `INSERT INTO inventory_movements
          (location_id,product_id,quantity_delta,balance_after,type,reference_type,reference_id)
          VALUES (1,10,-1,4,'online_sale','order',?)`, [n],
      );
    }

    pool = mysql.createPool({ ...opts, database, connectionLimit: 6 });
    vi.doMock('@/lib/db', () => ({ db: drizzle(pool, { schema, mode: 'default' }) }));
    ({ processSandboxInvoiceEvent: processEvent } =
      await import('@/lib/checkout/process-sandbox-webhook'));
  }, 30000);

  afterAll(async () => {
    vi.doUnmock('@/lib/db');
    if (pool) await pool.end();
    if (admin && created) await admin.query('DROP DATABASE ??', [database]);
    if (admin) await admin.end();
  });

  const rows = async (sql: string) => {
    const [result] = await admin.query<RowDataPacket[]>(sql);
    return result;
  };

  it('commits PAID invoice/order/ledger together with one audit log and no stock return', async () => {
    const [a, b] = await Promise.all([
      processEvent(event(1, 'PAID')),
      processEvent(event(1, 'PAID')),
    ]);
    expect([a.decision, b.decision].sort()).toEqual(['duplicate', 'paid']);
    expect((await rows("SELECT status FROM orders WHERE id=1"))[0].status).toBe('packing');
    expect((await rows("SELECT invoice_status FROM invoices WHERE order_id=1"))[0].invoice_status).toBe('paid');
    expect((await rows("SELECT status FROM checkout_payment_attempts WHERE order_id=1"))[0].status).toBe('paid');
    expect(await rows("SELECT id FROM order_status_logs WHERE order_id=1")).toHaveLength(1);
    expect(await rows("SELECT id FROM inventory_movements WHERE reference_id=1 AND type='return'")).toHaveLength(0);
  });

  it('expires once and restores stock once, including concurrent duplicate EXPIRED callback', async () => {
    const [a, b] = await Promise.all([
      processEvent(event(2, 'EXPIRED')),
      processEvent(event(2, 'EXPIRED')),
    ]);
    expect([a.decision, b.decision].sort()).toEqual(['duplicate', 'expired']);
    expect((await rows("SELECT status FROM orders WHERE id=2"))[0].status).toBe('expired');
    expect((await rows("SELECT invoice_status FROM invoices WHERE order_id=2"))[0].invoice_status).toBe('expired');
    expect((await rows("SELECT status FROM checkout_payment_attempts WHERE order_id=2"))[0].status).toBe('expired');
    expect(await rows("SELECT id FROM order_status_logs WHERE order_id=2")).toHaveLength(1);
    expect(await rows("SELECT id FROM inventory_movements WHERE reference_id=2 AND type='return'")).toHaveLength(1);
    expect((await rows("SELECT stock FROM products WHERE id=10"))[0].stock).toBe(5);
    expect((await rows("SELECT quantity FROM inventory_balances WHERE product_id=10"))[0].quantity).toBe(5);
    expect((await processEvent(event(2, 'PAID'))).decision).toBe('conflict');
    expect(await rows("SELECT id FROM inventory_movements WHERE reference_id=2 AND type='return'")).toHaveLength(1);
  });

  it('retains backward compatibility for old SBX invoices without ledger rows', async () => {
    expect((await processEvent(event(3, 'PAID'))).decision).toBe('paid');
    expect(await rows("SELECT id FROM checkout_payment_attempts WHERE order_id=3")).toHaveLength(0);
    expect((await rows("SELECT status FROM orders WHERE id=3"))[0].status).toBe('packing');
  });

  it('repairs a previously PAID invoice whose ledger remained ready, without stock effects', async () => {
    expect((await processEvent(event(4, 'PAID'))).decision).toBe('duplicate');
    expect((await rows("SELECT status FROM checkout_payment_attempts WHERE order_id=4"))[0].status).toBe('paid');
    expect(await rows("SELECT id FROM order_status_logs WHERE order_id=4")).toHaveLength(0);
    expect(await rows("SELECT id FROM inventory_movements WHERE reference_id=4 AND type='return'")).toHaveLength(0);
  });

  it('fails closed when the signed event does not match the provider id stored in ledger', async () => {
    await expect(processEvent(event(5, 'PAID'))).rejects.toMatchObject({
      status: 503,
    });
    expect((await rows("SELECT status FROM orders WHERE id=5"))[0].status).toBe('waiting_payment');
    expect((await rows("SELECT status FROM checkout_payment_attempts WHERE order_id=5"))[0].status).toBe('ready');
    expect(await rows("SELECT id FROM order_status_logs WHERE order_id=5")).toHaveLength(0);
  });

  it('rolls back EXPIRED invoice and ledger when stock restoration fails', async () => {
    // Simulate a missing inventory balance for one order's item.
    await admin.query("DELETE FROM inventory_balances WHERE product_id=10");
    await expect(processEvent(event(6, 'EXPIRED'))).rejects.toMatchObject({ status: 503 });
    expect((await rows("SELECT status FROM orders WHERE id=6"))[0].status).toBe('waiting_payment');
    expect((await rows("SELECT invoice_status FROM invoices WHERE order_id=6"))[0].invoice_status).toBe('pending');
    expect((await rows("SELECT status FROM checkout_payment_attempts WHERE order_id=6"))[0].status).toBe('ready');
    expect(await rows("SELECT id FROM inventory_movements WHERE reference_id=6 AND type='return'")).toHaveLength(0);
  });
});
