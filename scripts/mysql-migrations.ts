import { createHash } from 'node:crypto';
import { readMigrationFiles, type MigrationMeta } from 'drizzle-orm/migrator';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { assertLegacyBaselineTarget, assertLegacySchema, matchLegacyBaseline, type LegacyBaselineTarget } from './mysql-legacy-baseline';

export const migrationsFolder = 'lib/db/migrations';

export function verifiedMigrationPrefix(
  journal: ReadonlyArray<{ hash: string; created_at: number | string | null }>,
  migrations: readonly MigrationMeta[],
): number {
  if (journal.length > migrations.length || journal.some((row, index) =>
    row.hash !== migrations[index].hash || Number(row.created_at) !== migrations[index].folderMillis)) {
    throw new Error('Migration journal is not a verified prefix of the repository history');
  }
  return journal.length;
}

/** This connection accepts batches only from immutable repository migration files.
 * Application queries and operator-provided SQL never use it.
 */
export async function applyMysqlMigrations(
  databaseUrl: string,
  migrations = readMigrationFiles({ migrationsFolder }),
  legacyTarget?: LegacyBaselineTarget,
  approvedAddress?: string,
) {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== 'mysql:' || parsed.pathname.length < 2) {
    throw new Error('A MySQL database is required');
  }
  if (legacyTarget) assertLegacyBaselineTarget(parsed, legacyTarget);
  const connection = await mysql.createConnection({ uri: databaseUrl, host: approvedAddress, multipleStatements: true });
  try {
    const [db] = await connection.query<RowDataPacket[]>('SELECT DATABASE() AS name');
    const lockName = 'onetone_migrate:' + createHash('sha256').update(db[0].name).digest('hex').slice(0, 40);
    const [lock] = await connection.execute<RowDataPacket[]>('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
    if (lock[0].acquired !== 1) throw new Error('Another migration is already running');

    const [existingTables] = await connection.query<RowDataPacket[]>(`SELECT TABLE_NAME AS name
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`);
    const hasJournal = existingTables.some(table => table.name === '__drizzle_migrations');
    if (legacyTarget && (!hasJournal || !existingTables.some(table => table.name === '__onetone_migration_in_progress'))) {
      throw new Error('Legacy migration requires existing journal and checkpoint tables');
    }
    const hasApplicationTables = existingTables.some(table =>
      !['__drizzle_migrations', '__onetone_migration_in_progress'].includes(table.name));
    if (!hasJournal && hasApplicationTables) {
      throw new Error('Non-empty database has no migration journal; verify its baseline before migrating');
    }

    if (!legacyTarget) {
      await connection.query(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at BIGINT
      ) ENGINE=InnoDB`);
      await connection.query(`CREATE TABLE IF NOT EXISTS __onetone_migration_in_progress (
        id TINYINT PRIMARY KEY, migration_hash CHAR(64) NOT NULL, migration_timestamp BIGINT NOT NULL
      ) ENGINE=InnoDB`);
    }
    const [tables] = await connection.query<RowDataPacket[]>(`SELECT ENGINE AS engine
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('__drizzle_migrations', '__onetone_migration_in_progress')`);
    if (tables.length !== 2 || tables.some(table => table.engine !== 'InnoDB')) {
      throw new Error('Migration metadata tables must use InnoDB');
    }

    const [unfinished] = await connection.query<RowDataPacket[]>('SELECT migration_timestamp FROM __onetone_migration_in_progress');
    if (unfinished.length !== 0) {
      throw new Error(`Interrupted migration at ${unfinished[0].migration_timestamp}; restore verified backup before retrying`);
    }
    const [journal] = await connection.query<(RowDataPacket & {
      hash: string; created_at: number | string | null;
    })[]>('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, id');
    const previous = legacyTarget ? matchLegacyBaseline(journal, migrations) : verifiedMigrationPrefix(journal, migrations);
    if (legacyTarget) await assertLegacySchema(connection, previous === migrations.length);
    if (previous === 0 && hasApplicationTables) {
      throw new Error('Non-empty database has an empty migration journal; verify its baseline before migrating');
    }

    for (const migration of migrations.slice(previous)) {
      await connection.execute(`INSERT INTO __onetone_migration_in_progress
        (id, migration_hash, migration_timestamp) VALUES (1, ?, ?)`, [migration.hash, migration.folderMillis]);
      try {
        for (const statement of migration.sql) {
          if (statement.trim()) await connection.query(statement);
        }
        if (legacyTarget) await assertLegacySchema(connection, true);
        // The checkpoint survives MySQL DDL implicit commits. Journal and
        // checkpoint cleanup are finalized together once all SQL succeeds.
        await connection.beginTransaction();
        await connection.execute('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
          [migration.hash, migration.folderMillis]);
        await connection.execute('DELETE FROM __onetone_migration_in_progress WHERE id = 1');
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw new Error(`Migration ${migration.folderMillis} failed; checkpoint retained`, { cause: error });
      }
    }
    return { previous, applied: migrations.length - previous };
  } finally {
    // Closing this dedicated session also releases its advisory lock.
    await connection.end();
  }
}
