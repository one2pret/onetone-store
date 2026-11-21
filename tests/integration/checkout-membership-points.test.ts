// @vitest-environment node
// Uses only a fresh, disposable LOCAL MySQL schema. Never hits live databases.
import { randomUUID } from 'node:crypto';
import mysql, { type Connection, type Pool, type RowDataPacket } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '@/lib/db/schema';
import {
  debitCheckoutMembershipPoints,
  loadLockedCheckoutMembership,
} from '@/lib/checkout/transactional-membership-points';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const url = process.env.SANDBOX_BOOKING_TEST_DATABASE_URL;
const database = 'sbx_membership_checkout_' + randomUUID().replaceAll('-', '');
let admin: Connection;
let pool: Pool;
let created = false;

describe.skipIf(!url)('shared checkout membership points transaction (isolated MySQL)', () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
        parsed.pathname !== '/sbx_booking_test') {
      throw new Error('Dedicated LOCAL sbx_booking_test DB URL required');
    }
    const credentials = {
      host: parsed.hostname, port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
    admin = await mysql.createConnection(credentials);
    await admin.query('CREATE DATABASE ??', [database]);
    created = true;
    await admin.changeUser({ database });
    await admin.query(`CREATE TABLE member_tiers (
      id INT PRIMARY KEY, free_shipping_threshold INT NULL
    ) ENGINE=InnoDB`);
    await admin.query(`CREATE TABLE memberships (
      id INT PRIMARY KEY, user_id INT NOT NULL UNIQUE, tier_id INT NOT NULL,
      points INT NULL
    ) ENGINE=InnoDB`);
    await admin.query(`CREATE TABLE orders (id INT PRIMARY KEY) ENGINE=InnoDB`);
    await admin.query(`CREATE TABLE points_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY, membership_id INT NOT NULL,
      order_id INT NULL, delta INT NOT NULL, reason VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY points_ledger_membership_order_reason_unique
        (membership_id, order_id, reason)
    ) ENGINE=InnoDB`);
    await admin.query('INSERT INTO member_tiers (id,free_shipping_threshold) VALUES (1,30000),(2,NULL)');
    await admin.query('INSERT INTO memberships (id,user_id,tier_id,points) VALUES (1,101,1,70),(2,102,2,60)');
    await admin.query('INSERT INTO orders (id) VALUES (1),(2),(3),(4),(5),(6)');
    pool = mysql.createPool({ ...credentials, database, connectionLimit: 6 });
  }, 30000);

  afterAll(async () => {
    await pool?.end();
    if (admin && created) await admin.query('DROP DATABASE ??', [database]);
    await admin?.end();
  });

  const getDb = () => drizzle(pool, { schema, mode: 'default' });

  it('loads the current points and tier policy under a transaction row lock', async () => {
    const member = await getDb().transaction(tx => loadLockedCheckoutMembership(tx, 101));
    expect(member).toEqual({ id: 1, points: 70, freeShippingThreshold: 30000 });
    const missing = await getDb().transaction(tx => loadLockedCheckoutMembership(tx, 999));
    expect(missing).toBeNull();
  });

  it('debits the exact validated points and writes one order ledger entry', async () => {
    await getDb().transaction(async tx => {
      const member = await loadLockedCheckoutMembership(tx, 101);
      expect(member?.points).toBe(70);
      await debitCheckoutMembershipPoints(tx, { membershipId: member!.id, orderId: 1, points: 10 });
    });
    const [balances] = await admin.query<RowDataPacket[]>('SELECT points FROM memberships WHERE id=1');
    const [ledger] = await admin.query<RowDataPacket[]>(
      'SELECT order_id,delta,reason FROM points_ledger WHERE membership_id=1',
    );
    expect(balances[0].points).toBe(60);
    expect(ledger).toEqual([{ order_id: 1, delta: -10, reason: 'order_redeem' }]);
  });

  it('rolls back points and ledger together if a later checkout step throws', async () => {
    await expect(getDb().transaction(async tx => {
      await debitCheckoutMembershipPoints(tx, { membershipId: 1, orderId: 2, points: 20 });
      throw new Error('stock changed; rollback');
    })).rejects.toThrow('stock changed');
    const [balances] = await admin.query<RowDataPacket[]>('SELECT points FROM memberships WHERE id=1');
    const [ledger] = await admin.query<RowDataPacket[]>('SELECT id FROM points_ledger WHERE order_id=2');
    expect(balances[0].points).toBe(60);
    expect(ledger).toHaveLength(0);
  });

  it('rejects a duplicate redemption ledger and rolls back any balance update', async () => {
    await expect(getDb().transaction(async tx => {
      await debitCheckoutMembershipPoints(tx, { membershipId: 1, orderId: 1, points: 1 });
    })).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    const [balances] = await admin.query<RowDataPacket[]>('SELECT points FROM memberships WHERE id=1');
    expect(balances[0].points).toBe(60);
  });

  it('allows one winner for simultaneous redemptions of an insufficient combined balance', async () => {
    const redeem = (orderId: number) => getDb().transaction(async tx => {
      const member = await loadLockedCheckoutMembership(tx, 102);
      expect(member).not.toBeNull();
      await debitCheckoutMembershipPoints(tx, { membershipId: member!.id, orderId, points: 40 });
    });
    const results = await Promise.allSettled([redeem(3), redeem(4)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const [balances] = await admin.query<RowDataPacket[]>('SELECT points FROM memberships WHERE id=2');
    const [ledger] = await admin.query<RowDataPacket[]>(
      "SELECT delta,order_id FROM points_ledger WHERE membership_id=2 AND reason='order_redeem'",
    );
    expect(balances[0].points).toBe(20);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].delta).toBe(-40);
  });

  it('zero points does not create a ledger row', async () => {
    await getDb().transaction(tx => debitCheckoutMembershipPoints(tx, {
      membershipId: 2, orderId: 5, points: 0,
    }));
    const [ledger] = await admin.query<RowDataPacket[]>('SELECT id FROM points_ledger WHERE order_id=5');
    expect(ledger).toHaveLength(0);
  });

  it('rejects malformed debit args before any mutation', async () => {
    await expect(getDb().transaction(tx => debitCheckoutMembershipPoints(tx, {
      membershipId: 1, orderId: 6, points: -10,
    }))).rejects.toThrow('Invalid checkout membership debit arguments');
    const [ledger] = await admin.query<RowDataPacket[]>('SELECT id FROM points_ledger WHERE order_id=6');
    expect(ledger).toHaveLength(0);
  });
});
