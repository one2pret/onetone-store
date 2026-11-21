// @vitest-environment node
import { randomUUID } from 'node:crypto';
import mysql, { type Connection, type Pool, type RowDataPacket } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/lib/db/schema';
import { loadCheckoutVoucher, reserveCheckoutVoucher } from '@/lib/checkout/transactional-voucher';

const url = process.env.SANDBOX_BOOKING_TEST_DATABASE_URL;
const database = 'sbx_voucher_' + randomUUID().replaceAll('-', '');
let admin: Connection;
let pool: Pool;
let created = false;
const now = new Date('2026-11-20T10:00:00Z');

describe.skipIf(!url)('voucher reservation on disposable MySQL', () => {
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
    await admin.query(`CREATE TABLE vouchers (
      id INT PRIMARY KEY, code VARCHAR(50), name VARCHAR(120), description TEXT,
      voucher_type VARCHAR(30), value INT, min_spend INT, store_id INT, tier_id INT,
      quota INT, used_count INT, voucher_audience VARCHAR(30), valid_days_after_grant INT,
      max_uses_per_user INT, first_order_only BOOLEAN, allow_points BOOLEAN,
      starts_at TIMESTAMP NULL, ends_at TIMESTAMP NULL, is_active BOOLEAN, archived_at TIMESTAMP NULL
    ) ENGINE=InnoDB`);
    await admin.query(`CREATE TABLE user_vouchers (
      id INT PRIMARY KEY, user_id INT NOT NULL, voucher_id INT NOT NULL,
      user_voucher_status VARCHAR(30), granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NULL, reserved_order_id INT NULL, reserved_at TIMESTAMP NULL,
      redeemed_order_id INT NULL, redeemed_at TIMESTAMP NULL, UNIQUE KEY (user_id, voucher_id)
    ) ENGINE=InnoDB`);
    await admin.query('CREATE TABLE memberships (id INT PRIMARY KEY, user_id INT UNIQUE, tier_id INT, points INT, total_spend INT, joined_at TIMESTAMP NULL) ENGINE=InnoDB');
    await admin.query("INSERT INTO vouchers (id,code,voucher_type,value,min_spend,used_count,voucher_audience,max_uses_per_user,first_order_only,allow_points,is_active) VALUES (1,'TEST','fixed',5000,10000,0,'new_user',1,false,true,true)");
    await admin.query("INSERT INTO user_vouchers (id,user_id,voucher_id,user_voucher_status) VALUES (1,10,1,'available')");
    pool = mysql.createPool({ ...options, database, connectionLimit: 4 });
  }, 30000);
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query('DROP DATABASE ??', [database]);
    await admin?.end();
  });
  const getDb = () => drizzle(pool, { schema, mode: 'default' });
  const load = (tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0], userId = 10) =>
    loadCheckoutVoucher(tx, { userId, voucherId: 1, subtotal: 20000 });

  it('uses server-side discount and rejects a different owner and insufficient subtotal', async () => {
    await getDb().transaction(async tx => {
      const voucher = await load(tx);
      expect(voucher).toMatchObject({ voucherId: 1, grantId: 1, discountAmount: 5000, allowPoints: true });
    });
    await expect(getDb().transaction(tx => load(tx, 11))).rejects.toThrow();
    await expect(getDb().transaction(tx => loadCheckoutVoucher(tx, { userId: 10, voucherId: 1, subtotal: 9999 }))).rejects.toThrow();
  });

  it('fails closed for quota, first-order, tier and expired policies', async () => {
    for (const update of ["quota=1", "first_order_only=true", "tier_id=2", "ends_at='2026-11-19 00:00:00'"]) {
      await admin.query(`UPDATE vouchers SET ${update} WHERE id=1`);
      await expect(getDb().transaction(tx => load(tx))).rejects.toThrow();
      await admin.query('UPDATE vouchers SET quota=NULL, first_order_only=false, tier_id=NULL, ends_at=NULL WHERE id=1');
    }
  });

  it('rolls back a reservation when a later stock step fails', async () => {
    await expect(getDb().transaction(async tx => {
      const voucher = await load(tx);
      await reserveCheckoutVoucher(tx, { userId: 10, grantId: voucher.grantId, orderId: 77, now });
      throw new Error('stock failure');
    })).rejects.toThrow('stock failure');
    const [rows] = await admin.query<RowDataPacket[]>('SELECT user_voucher_status, reserved_order_id FROM user_vouchers WHERE id=1');
    expect(rows[0]).toMatchObject({ user_voucher_status: 'available', reserved_order_id: null });
  });

  it('allows only one concurrent reservation and prevents reuse', async () => {
    const attempt = (orderId: number) => getDb().transaction(async tx => {
      const voucher = await load(tx);
      await reserveCheckoutVoucher(tx, { userId: 10, grantId: voucher.grantId, orderId, now });
    });
    const results = await Promise.allSettled([attempt(100), attempt(101)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    await expect(attempt(102)).rejects.toThrow();
  });
});
