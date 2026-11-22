// @vitest-environment node
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMysqlMigrations, migrationsFolder } from '../../scripts/mysql-migrations';
import { loadMysqlSchemaContract, missingMysqlSchema, readMysqlSchemaInventory } from '../../scripts/mysql-schema-parity';
import * as schema from '@/lib/db/schema';

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

  it('matches all required ORM and migration-layer signatures on a fresh schema', async () => {
    const db = await fixture();
    const modelDb = await fixture();
    await applyMysqlMigrations(db.url);
    const actual = await mysql.createConnection(db.url);
    const model = await mysql.createConnection(modelDb.url);
    try {
      const { generateMySQLDrizzleJson, generateMySQLMigration } =
        createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api');
      const sql = await generateMySQLMigration(await generateMySQLDrizzleJson({}), await generateMySQLDrizzleJson(schema));
      for (const statement of sql) await model.query(statement);
      // The contract must stay aligned with the application model. Additional
      // historical checks in the contract must also exist on a migrated DB.
      const expected = await readMysqlSchemaInventory(model);
      expect(missingMysqlSchema(loadMysqlSchemaContract(), expected)).toEqual({
        columns: [], indexes: [], foreignKeys: [], checks: [],
      });
      expect(missingMysqlSchema(await readMysqlSchemaInventory(actual))).toEqual({
        columns: [], indexes: [], foreignKeys: [], checks: [],
      });
      await actual.query('CREATE INDEX fixture_membership_support ON points_ledger (membership_id)');
      await actual.query('DROP INDEX points_ledger_membership_order_reason_unique ON points_ledger');
      const broken = missingMysqlSchema(await readMysqlSchemaInventory(actual));
      expect(broken.indexes).toContainEqual([
        'points_ledger', [false, 0, 'membership_id', null, 'BTREE', 'A', 'YES'],
        [false, 0, 'order_id', null, 'BTREE', 'A', 'YES'],
        [false, 0, 'reason', null, 'BTREE', 'A', 'YES'],
      ]);
    } finally {
      await actual.end();
      await model.end();
    }
  }, 30000);

  it('keeps populated pre-existing parity columns, tables and equivalent foreign keys', async () => {
    const db = await fixture();
    const prefix = migrations.slice(0, -1);
    await applyMysqlMigrations(db.url, prefix);
    const connection = await mysql.createConnection(db.url);
    try {
      await connection.query('ALTER TABLE users ADD COLUMN birthdate varchar(10)');
      await connection.query("INSERT INTO users (id,name,email,password,birthdate) VALUES (1,'Fixture','fixture@example.test','fixture','2000-01-01')");
      const affiliateDDL = migrations.at(-1)!.sql.find(statement =>
        statement.includes('CREATE TABLE IF NOT EXISTS `affiliates`'));
      if (!affiliateDDL) throw new Error('Affiliate fixture DDL missing');
      await connection.query(affiliateDDL);
      await connection.query('ALTER TABLE affiliates ADD CONSTRAINT installed_affiliate_owner_fk FOREIGN KEY (user_id) REFERENCES users(id)');
      await connection.query("INSERT INTO affiliates (id,user_id,code) VALUES (1,1,'FIXTURE')");
      const before = missingMysqlSchema(await readMysqlSchemaInventory(connection));
      expect(before.columns.length).toBeGreaterThan(0);
      expect(await applyMysqlMigrations(db.url)).toEqual({ previous: prefix.length, applied: 1 });
      expect(await applyMysqlMigrations(db.url)).toEqual({ previous: migrations.length, applied: 0 });
      const [data] = await connection.query<RowDataPacket[]>('SELECT u.birthdate, a.code, a.affiliate_status FROM users u JOIN affiliates a ON a.user_id=u.id WHERE u.id=1');
      expect(data).toEqual([{ birthdate: '2000-01-01', code: 'FIXTURE', affiliate_status: 'pending' }]);
      expect(missingMysqlSchema(await readMysqlSchemaInventory(connection))).toEqual({
        columns: [], indexes: [], foreignKeys: [], checks: [],
      });
    } finally {
      await connection.end();
    }
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
