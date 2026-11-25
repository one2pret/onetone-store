import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { applyMysqlMigrations } from './mysql-migrations';
import { verifyMysqlRuntimeSchema } from './mysql-schema-parity';
import { isStagingDatabaseUrl } from './staging-preflight-target';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const args = process.argv.slice(2);
  const staging = ['--staging', '--legacy-staging-baseline'].includes(args[0]) && process.env.APP_ENV === 'staging';
  const legacyTarget = args[0] === '--legacy-staging-baseline' && staging ? 'staging' :
    args[0] === '--legacy-clone-baseline' && process.env.APP_ENV !== 'production' ? 'clone' : undefined;
  if (args.length !== 0 && (args.length !== 1 || (!staging && !legacyTarget))) throw new Error('Unapproved migration mode');
  let approvedAddress: string | undefined;
  if (staging) {
    const ip = process.env.STAGING_MIGRATION_DB_IP;
    if (!ip || isIP(ip) !== 4 || !isStagingDatabaseUrl(url)) throw new Error('Unexpected staging migration target');
    const addresses = await lookup('onetone-db', { all: true });
    if (addresses.length !== 1 || addresses[0].address !== ip) throw new Error('Unexpected staging migration address');
    approvedAddress = ip;
  }
  console.info('mysql_migrations', await applyMysqlMigrations(url, undefined, legacyTarget, approvedAddress));
  const schema = await verifyMysqlRuntimeSchema(url, approvedAddress);
  console.info(JSON.stringify(schema));
  if (schema.status !== 'PASS') process.exitCode = 1;
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
