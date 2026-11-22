// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMysqlMigrations, migrationsFolder } from '../../scripts/mysql-migrations';

const url = process.env.SANDBOX_BOOKING_TEST_DATABASE_URL;
const migrations = readMigrationFiles({ migrationsFolder });
let admin: Connection;
const databases: string[] = [];

describe.skipIf(!url)('versioned MySQL migrations on disposable schemas', () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (parsed.protocol !== 'mysql:' || !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
        parsed.pathname !== '/sbx_booking_test') throw new Error('Local disposable MySQL required');
    parsed.pathname = '/';
    admin = await mysql.createConnection(parsed.href);
  });
  afterAll(async () => {
    for (const name of databases) await admin.query('DROP DATABASE ??', [name]);
    await admin?.end();
  });

  async function fixture() {
    const name = 'v07_migration_' + randomUUID().replaceAll('-', '');
    await admin.query('CREATE DATABASE ??', [name]);
    databases.push(name);
    const parsed = new URL(url!);
    parsed.pathname = '/' + name;
    return { name, url: parsed.href };
  }

  it('applies fresh history, verifies hashes and reruns without changes', async () => {
    const db = await fixture();
    expect(await applyMysqlMigrations(db.url)).toEqual({ previous: 0, applied: migrations.length });
    expect(await applyMysqlMigrations(db.url)).toEqual({ previous: migrations.length, applied: 0 });
    const [journal] = await admin.query<RowDataPacket[]>('SELECT hash, created_at FROM ??.__drizzle_migrations ORDER BY created_at', [db.name]);
    expect(journal.map(row => ({ hash: row.hash, timestamp: Number(row.created_at) }))).toEqual(
      migrations.map(file => ({ hash: file.hash, timestamp: file.folderMillis })),
    );
    const [schema] = await admin.execute<RowDataPacket[]>(`SELECT TABLE_NAME AS name, COLUMN_NAME AS column_name
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND
      ((TABLE_NAME = 'products' AND COLUMN_NAME = 'sale_price') OR
       (TABLE_NAME = 'order_items' AND COLUMN_NAME = 'unit_weight_grams') OR
       (TABLE_NAME = 'checkout_payment_attempts' AND COLUMN_NAME = 'status'))`, [db.name]);
    expect(schema).toHaveLength(3);
    const [indexes] = await admin.execute<RowDataPacket[]>(`SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND NON_UNIQUE = 0 AND INDEX_NAME IN (
        'user_vouchers_user_voucher_unique', 'points_ledger_membership_order_reason_unique',
        'checkout_payment_attempt_order_sequence_unique', 'checkout_payment_attempt_xendit_id_unique'
      )`, [db.name]);
    expect(indexes).toHaveLength(4);
  }, 30000);

  it('upgrades a populated legacy journal prefix and preserves existing rows', async () => {
    const db = await fixture();
    const legacy = await mysql.createConnection(db.url);
    try {
      // Seed a genuine historical journal without the new checkpoint table.
      for (const statement of migrations[0].sql) await legacy.query(statement);
      await legacy.query('CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at BIGINT)');
      await legacy.execute('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        [migrations[0].hash, migrations[0].folderMillis]);
      await legacy.query("INSERT INTO products (name, slug, price, stock) VALUES ('Legacy fixture', 'fixture', 15000, 4)");
    } finally {
      await legacy.end();
    }
    expect(await applyMysqlMigrations(db.url)).toEqual({ previous: 1, applied: migrations.length - 1 });
    const [products] = await admin.query<RowDataPacket[]>('SELECT slug, price, stock, sale_price FROM ??.products', [db.name]);
    expect(products).toEqual([{ slug: 'fixture', price: '15000.00', stock: 4, sale_price: null }]);
  }, 30000);

  it('retains an interruption checkpoint and resumes only from a clean restored prefix', async () => {
    const db = await fixture();
    await applyMysqlMigrations(db.url, migrations.slice(0, 1));
    const interrupted = { ...migrations[1], sql: [
      'ALTER TABLE products ADD COLUMN sale_price DECIMAL(12,2)',
      "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'simulated interruption'",
    ] };
    await expect(applyMysqlMigrations(db.url, [migrations[0], interrupted])).rejects.toThrow('checkpoint retained');
    await expect(applyMysqlMigrations(db.url)).rejects.toThrow('Interrupted migration');
    const [journal] = await admin.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM ??.__drizzle_migrations', [db.name]);
    expect(journal[0].count).toBe(1);
    const restored = await fixture();
    await applyMysqlMigrations(restored.url, migrations.slice(0, 1));
    expect(await applyMysqlMigrations(restored.url)).toEqual({ previous: 1, applied: migrations.length - 1 });
  }, 30000);

  it('leaves an unjournaled populated database unchanged', async () => {
    const db = await fixture();
    await admin.query('CREATE TABLE ??.untracked_fixture (id INT PRIMARY KEY)', [db.name]);
    await admin.query('INSERT INTO ??.untracked_fixture VALUES (1)', [db.name]);
    await expect(applyMysqlMigrations(db.url)).rejects.toThrow('has no migration journal');
    const [tables] = await admin.execute<RowDataPacket[]>(`SELECT TABLE_NAME AS name FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?`, [db.name]);
    expect(tables).toEqual([{ name: 'untracked_fixture' }]);
  });

  it('rejects an incompatible historical hash', async () => {
    const db = await fixture();
    await applyMysqlMigrations(db.url, migrations.slice(0, 1));
    await admin.query("UPDATE ??.__drizzle_migrations SET hash = 'different'", [db.name]);
    await expect(applyMysqlMigrations(db.url)).rejects.toThrow('not a verified prefix');
  }, 30000);
});
