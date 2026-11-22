import { spawnSync } from 'node:child_process';
import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { MySqlTable } from 'drizzle-orm/mysql-core';
import * as schema from '../lib/db/schema';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { migrationsFolder } from './mysql-migrations';

type Status = 'PASS' | 'FAIL' | 'UNVERIFIED';
const [container, expectedSha, expectedDigest, approvedOrderId] = process.argv.slice(2);

function report(check: string, status: Status, evidence: unknown) {
  console.log(JSON.stringify({ check, status, evidence }));
  if (status === 'FAIL') process.exitCode = 1;
  if (status === 'UNVERIFIED' && !process.exitCode) process.exitCode = 3;
}

function docker(args: string[], input?: string) {
  const result = spawnSync('docker', args, { encoding: 'utf8', input, timeout: 15_000, maxBuffer: 2_000_000 });
  return result.status === 0 ? result.stdout.trim() : null;
}

if (!container || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(container) ||
    !/^[a-f0-9]{40}$/.test(expectedSha ?? '') ||
    !/^sha256:[a-f0-9]{64}$/.test(expectedDigest ?? '') ||
    (approvedOrderId !== undefined && !/^[1-9][0-9]{0,9}$/.test(approvedOrderId))) {
  console.error('Usage: staging-readonly-preflight <container> <approved-sha> <approved-digest> [approved-test-order-id]');
  process.exit(2);
}

const image = docker(['inspect', '--type', 'container', '--format', '{{.Image}}', container]);
const revision = image && docker(['image', 'inspect', '--format',
  '{{index .Config.Labels "org.opencontainers.image.revision"}}', image]);
const digestOutput = image && docker(['image', 'inspect', '--format', '{{range .RepoDigests}}{{println .}}{{end}}', image]);
const digests: string[] = digestOutput?.match(/(?<=@)sha256:[a-f0-9]{64}/g) ?? [];
const imageRevision = revision && /^[a-f0-9]{40}$/.test(revision) ? revision : null;
report('runtime_commit', imageRevision ? imageRevision === expectedSha ? 'PASS' : 'FAIL' : 'UNVERIFIED', imageRevision);
report('container_image_digest', digests.length ? digests.includes(expectedDigest) ? 'PASS' : 'FAIL' : 'UNVERIFIED', digests);

// The probe reads the current container environment and sends only normalized
// categories back. Never print environment variables, SQL errors or raw logs.
const probe = `
const journal = JSON.parse(process.argv[1]);
const expectedColumns = JSON.parse(process.argv[2]);
const orderId = process.argv[3];
const checks = [];
const add = (check, status, evidence) => checks.push({ check, status, evidence });
const env = process.env;
const stage = env.APP_ENV === 'staging';
add('application_environment', stage ? 'PASS' : 'FAIL', stage ? 'staging' : env.APP_ENV === 'production' ? 'production' : 'other_or_unset');
const key = env.XENDIT_SECRET_KEY || '';
const mode = key.startsWith('xnd_development_') && key.length > 'xnd_development_'.length
  ? 'TEST_PREFIX' : key.startsWith('xnd_production_') ? 'LIVE_PREFIX' : 'UNKNOWN';
add('payment_mode', mode === 'LIVE_PREFIX' ? 'FAIL' : mode === 'TEST_PREFIX' ? 'PASS' : 'UNVERIFIED', mode);
const flags = Object.fromEntries([
  'CHECKOUT_SANDBOX_VOUCHER_ENABLED', 'CHECKOUT_SANDBOX_ORDER_ENABLED', 'CHECKOUT_SANDBOX_PAYMENT_LEDGER_ENABLED',
  'BITESHIP_SANDBOX_BOOKING_ENABLED',
].map(name => [name, env[name] === 'true']));
add('voucher_feature_flags', flags.CHECKOUT_SANDBOX_VOUCHER_ENABLED ? 'FAIL' : 'PASS', { ...flags, expectedVoucherEnabled: false });
add('webhook_readiness', env.XENDIT_WEBHOOK_TOKEN ? 'UNVERIFIED' : 'FAIL', {
  callbackTokenConfigured: Boolean(env.XENDIT_WEBHOOK_TOKEN), providerDeliveryUnverified: true,
});

async function main() {
  let connection;
  try {
    if (!stage || mode !== 'TEST_PREFIX') return;
    const mysql = require('mysql2/promise');
    connection = await mysql.createConnection({ uri: env.DATABASE_URL, connectTimeout: 5000 });
    await connection.query('SELECT 1');
    add('database_connectivity', 'PASS', 'read_only_probe');
    const [tables] = await connection.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('__drizzle_migrations','__onetone_migration_in_progress')");
    const hasJournal = tables.some(row => row.name === '__drizzle_migrations');
    const hasCheckpoint = tables.some(row => row.name === '__onetone_migration_in_progress');
    const [applied] = hasJournal ? await connection.query('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, id') : [[]];
    const [unfinished] = hasCheckpoint ? await connection.query('SELECT COUNT(*) AS count FROM __onetone_migration_in_progress') : [[{count: 0}]];
    const matches = applied.length === journal.length && applied.every((row, index) =>
      row.hash === journal[index].hash && Number(row.created_at) === journal[index].timestamp);
    const pending = Number(unfinished[0].count);
    add('database_migrations', !matches || pending ? 'FAIL' : hasCheckpoint ? 'PASS' : 'UNVERIFIED',
      { applied: applied.length, expected: journal.length, unfinished: pending, checkpointTable: hasCheckpoint });
    const [columns] = await connection.query("SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()");
    const actualColumns = new Set(columns.map(row => row.table_name + '.' + row.column_name));
    const missingColumns = expectedColumns.filter(column => !actualColumns.has(column));
    add('database_schema', missingColumns.length ? 'FAIL' : 'PASS', { missingColumns });
    if (orderId) {
      const [rows] = await connection.execute(
        "SELECT a.status AS attempt_status, a.updated_at AS updated_at FROM orders o JOIN checkout_payment_attempts a ON a.order_id=o.id WHERE o.id=? AND o.order_number LIKE 'SBX-%' AND o.voucher_id IS NOT NULL AND a.mode='sandbox' LIMIT 2", [orderId]);
      const status = rows.length === 1 && ['reserved','requesting','needs_reconciliation','ready','paid','expired','failed'].includes(rows[0].attempt_status)
        ? rows[0].attempt_status : null;
      add('reconciliation_diagnostics', status ? 'PASS' : 'UNVERIFIED', { attemptStatus: status, matches: rows.length });
    }
  } catch {
    // Missing permissions or missing runtime dependencies leave the probe unverified.
  } finally {
    if (connection) await connection.end().catch(() => {});
    for (const name of ['database_connectivity', 'database_migrations', 'database_schema', 'reconciliation_diagnostics']) {
      if (!checks.some(row => row.check === name)) add(name, 'UNVERIFIED', null);
    }
    console.log(JSON.stringify(checks));
  }
}
void main();
`;

const journal = readMigrationFiles({ migrationsFolder }).map(({ hash, folderMillis }) => ({ hash, timestamp: folderMillis }));
const expectedColumns = Object.values(schema).filter(table => is(table, MySqlTable))
  .flatMap(table => Object.values(getTableColumns(table)).map(column => getTableName(table) + '.' + column.name));
const output = docker(['exec', container, 'node', '-e', probe, JSON.stringify(journal),
  JSON.stringify(expectedColumns), approvedOrderId ?? '']);
let checks: { check: string; status: Status; evidence: unknown }[] | null = null;
try {
  if (output) checks = JSON.parse(output);
} catch {
  // A failed runtime probe does not prove its checks.
}
if (Array.isArray(checks)) {
  for (const row of checks) report(row.check, row.status, row.evidence);
} else {
  for (const check of ['application_environment', 'payment_mode', 'voucher_feature_flags', 'webhook_readiness',
    'database_connectivity', 'database_migrations', 'database_schema', 'reconciliation_diagnostics']) report(check, 'UNVERIFIED', null);
}

const logs = spawnSync('docker', ['logs', '--since', '30m', '--tail', '500', container],
  { encoding: 'utf8', timeout: 10_000, maxBuffer: 2_000_000 });
const events = ['sandbox_invoice_setup', 'sandbox_settlement', 'sandbox_cancellation', 'sandbox_invoice_recovery'];
const counts = logs.status === 0
  ? Object.fromEntries(events.map(event => [event, (logs.stdout + logs.stderr).split('\n').filter(line => line.startsWith(event + ' ')).length]))
  : null;
report('structured_logs', counts && Object.values(counts).some(count => count > 0) ? 'PASS' : 'UNVERIFIED',
  { counts, redactionReviewRequired: true });
