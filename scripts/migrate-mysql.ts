import { applyMysqlMigrations } from './mysql-migrations';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  console.info('mysql_migrations', await applyMysqlMigrations(url));
}

void main().catch(error => {
  // The cause is limited to static migration SQL metadata. Do not print the
  // connection object, URL or driver stack on deployment consoles.
  console.error(error instanceof Error ? error.message : 'MySQL migration failed');
  if (error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause) {
    console.error('mysql_migration_error', { code: error.cause.code });
  }
  process.exitCode = 1;
});
