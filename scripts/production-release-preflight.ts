import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { migrationsFolder, verifiedMigrationPrefix } from './mysql-migrations';
import { missingMysqlSchema, readMysqlSchemaInventory } from './mysql-schema-parity';

export async function verifyProductionReleaseDatabase(connection: Connection) {
  await connection.query('START TRANSACTION READ ONLY');
  try {
    const [metadata] = await connection.query<RowDataPacket[]>(`SELECT TABLE_NAME AS name, ENGINE AS engine
      FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
      AND TABLE_NAME IN ('__drizzle_migrations', '__onetone_migration_in_progress')`);
    if (metadata.length !== 2 || metadata.some(table => table.engine !== 'InnoDB')) {
      throw new Error('migration_metadata');
    }
    const [checkpoint] = await connection.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM __onetone_migration_in_progress');
    if (Number(checkpoint[0].count) !== 0) throw new Error('unfinished_checkpoint');
    const [journal] = await connection.query<(RowDataPacket & { hash: string; created_at: string | null })[]>(
      'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, id');
    const expected = readMigrationFiles({ migrationsFolder });
    if (verifiedMigrationPrefix(journal, expected) !== expected.length) throw new Error('migration_history_incomplete');
    const missing = missingMysqlSchema(await readMysqlSchemaInventory(connection));
    if (Object.values(missing).some(items => items.length)) throw new Error('schema_parity');
    return { journalEntries: journal.length };
  } finally {
    await connection.rollback();
  }
}

export function isProductionPreflightTarget(value: string | undefined, appEnv: string | undefined, ip: string | undefined) {
  if (appEnv !== 'production' || !ip || isIP(ip) !== 4 || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'mysql:' && url.hostname === 'onetone-db' &&
      ['', '3306'].includes(url.port) && url.pathname === '/onetone_db' &&
      url.username === 'onetone_release_readonly' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

async function main() {
  let phase = 'target_guard';
  try {
    const { PRODUCTION_PREFLIGHT_DATABASE_URL: uri, APP_ENV, PRODUCTION_PREFLIGHT_DB_IP: ip } = process.env;
    if (!isProductionPreflightTarget(uri, APP_ENV, ip)) throw new Error();
    const addresses = await lookup('onetone-db', { all: true });
    if (addresses.length !== 1 || addresses[0].address !== ip) throw new Error();
    phase = 'read_only_connection';
    const connection = await mysql.createConnection({ uri, host: ip, connectTimeout: 5000 });
    try {
      phase = 'migration_history_and_schema';
      console.log(JSON.stringify({ status: 'PASS', ...await verifyProductionReleaseDatabase(connection) }));
    } finally {
      await connection.end();
    }
  } catch {
    console.error(JSON.stringify({ status: 'FAIL', phase }));
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
