import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { hostname } from 'node:os';
import { isStagingDatabaseUrl, stagingComposeFile, stagingHost } from './staging-preflight-target';
import { diagnoseStagingJournal } from './staging-preflight-journal';
import { missingMysqlSchema, mysqlSchemaMetadataQueries, normalizeMysqlSchemaInventory } from './mysql-schema-parity';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { migrationsFolder } from './mysql-migrations';

type Status = 'PASS' | 'FAIL' | 'UNVERIFIED';
const [container, expectedSha, expectedDigest, approvedOrderId] = process.argv.slice(2);

function report(check: string, status: Status, evidence: unknown) {
  console.log(JSON.stringify({ check, status, evidence }));
  if (status === 'FAIL') process.exitCode = 1;
  if (status === 'UNVERIFIED' && !process.exitCode) process.exitCode = 3;
}

const dockerEnv = { ...process.env };
delete dockerEnv.DOCKER_CONTEXT;
delete dockerEnv.DOCKER_HOST;
const localDocker = ['--host', 'unix:///var/run/docker.sock'];

function docker(args: string[]) {
  const result = spawnSync('docker', [...localDocker, ...args], {
    encoding: 'utf8', timeout: 15_000, maxBuffer: 2_000_000, env: dockerEnv,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

if (container !== 'onetone-app' ||
    !/^[a-f0-9]{40}$/.test(expectedSha ?? '') ||
    !/^sha256:[a-f0-9]{64}$/.test(expectedDigest ?? '') ||
    (approvedOrderId !== undefined && !/^[1-9][0-9]{0,9}$/.test(approvedOrderId))) {
  console.error('Usage: staging-readonly-preflight <container> <approved-sha> <approved-digest> [approved-test-order-id]');
  process.exit(2);
}

if (hostname().split('.')[0].toLowerCase() !== stagingHost.toLowerCase()) {
  report('staging_host_guard', 'FAIL', 'approved_staging_host_required');
  process.exit(1);
}
report('staging_host_guard', 'PASS', stagingHost);

function inspectContainer(name: string) {
  const result = docker(['inspect', '--type', 'container', '--format',
    '{{println .Id}}{{println .Image}}{{println .State.Running}}{{println (json .Config.Labels)}}{{json .NetworkSettings.Networks}}', name]);
  if (!result) return null;
  const [id, image, running, rawLabels, rawNetworks] = result.split('\n');
  if (!/^[a-f0-9]{64}$/.test(id) || !/^sha256:[a-f0-9]{64}$/.test(image) || running !== 'true') return null;
  try {
    const labels = JSON.parse(rawLabels) as Record<string, string>;
    const networks = JSON.parse(rawNetworks) as Record<string, { IPAddress: string; NetworkID: string }>;
    if (labels['com.docker.compose.project.config_files'] !== stagingComposeFile ||
        labels['com.docker.compose.service'] !== name || !labels['com.docker.compose.project']) return null;
    return { id, image, project: labels['com.docker.compose.project'], networks };
  } catch {
    return null;
  }
}

const app = inspectContainer(container);
const db = inspectContainer('onetone-db');
const sharedAddresses = app && db && app.project === db.project
  ? Object.entries(db.networks).filter(([name, network]) => network.NetworkID &&
    network.NetworkID === app.networks[name]?.NetworkID && isIP(network.IPAddress) === 4)
    .map(([, network]) => network.IPAddress)
  : [];
if (!app || !db || sharedAddresses.length !== 1) {
  report('staging_compose_guard', 'FAIL', 'approved_running_compose_pair_required');
  process.exit(1);
}
report('staging_compose_guard', 'PASS', stagingComposeFile);

const image = app.image;
const revision = image && docker(['image', 'inspect', '--format',
  '{{index .Config.Labels "org.opencontainers.image.revision"}}', image]);
const digestOutput = image && docker(['image', 'inspect', '--format', '{{range .RepoDigests}}{{println .}}{{end}}', image]);
const digests: string[] = digestOutput?.match(/(?<=@)sha256:[a-f0-9]{64}/g) ?? [];
const imageRevision = revision && /^[a-f0-9]{40}$/.test(revision) ? revision : null;
report('runtime_commit', imageRevision ? imageRevision === expectedSha ? 'PASS' : 'FAIL' : 'UNVERIFIED', imageRevision);
report('container_image_digest', digests.length ? digests.includes(expectedDigest) ? 'PASS' : 'FAIL' : 'UNVERIFIED', digests);

// The probe reads the current container environment and sends only normalized
// categories back. Never print environment variables, SQL errors or raw logs.
const probe = String.raw`
const journal = JSON.parse(process.argv[1]);
const metadataQueries = JSON.parse(process.argv[2]);
const orderId = process.argv[3];
const expectedDbAddress = process.argv[4];
const parityIndex = Number(process.argv[5]);
const dbUrlAllowed = ${isStagingDatabaseUrl.toString()};
const diagnoseJournal = ${diagnoseStagingJournal.toString()};
const checks = [];
let schemaMetadata;
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
add('voucher_feature_flags', flags.CHECKOUT_SANDBOX_VOUCHER_ENABLED || flags.BITESHIP_SANDBOX_BOOKING_ENABLED ? 'FAIL' : 'PASS',
  { ...flags, expectedVoucherEnabled: false, expectedBookingEnabled: false });
const testRateKey = /^biteship_test\.[A-Za-z0-9._-]+$/.test(env.BITSHIP_API_KEY || '');
const allowedRateOrigin = !env.BITSHIP_API_URL || env.BITSHIP_API_URL === 'https://api.biteship.com';
add('shipping_rate_mode', testRateKey && allowedRateOrigin ? 'PASS' : env.BITSHIP_API_KEY ? 'FAIL' : 'UNVERIFIED',
  { testRateKey, allowedRateOrigin });
add('webhook_readiness', env.XENDIT_WEBHOOK_TOKEN ? 'UNVERIFIED' : 'FAIL', {
  callbackTokenConfigured: Boolean(env.XENDIT_WEBHOOK_TOKEN), providerDeliveryUnverified: true,
});

async function main() {
  let connection;
  let phase = 'database_guard';
  try {
    if (!stage || !dbUrlAllowed(env.DATABASE_URL)) {
      add('staging_database_guard', 'FAIL', 'unexpected_database_target');
      return;
    }
    const addresses = await require('node:dns').promises.lookup('onetone-db', { all: true });
    if (addresses.length !== 1 || addresses[0].address !== expectedDbAddress) {
      add('staging_database_guard', 'FAIL', 'compose_database_address_mismatch');
      return;
    }
    add('staging_database_guard', 'PASS', 'approved_compose_database');
    phase = 'connect_read_only';
    const mysql = require('mysql2/promise');
    connection = await mysql.createConnection({ uri: env.DATABASE_URL, host: expectedDbAddress, connectTimeout: 5000 });
    await connection.query('START TRANSACTION READ ONLY');
    await connection.query('SELECT 1');
    add('database_connectivity', 'PASS', 'read_only_probe');
    phase = 'migration_metadata';
    const [tables] = await connection.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('__drizzle_migrations','__onetone_migration_in_progress')");
    const hasJournal = tables.some(row => row.name === '__drizzle_migrations');
    const hasCheckpoint = tables.some(row => row.name === '__onetone_migration_in_progress');
    const [applied] = hasJournal ? await connection.query('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, id') : [[]];
    const [unfinished] = hasCheckpoint ? await connection.query('SELECT COUNT(*) AS count FROM __onetone_migration_in_progress') : [[{count: 0}]];
    const { migrations, parityMigration } = diagnoseJournal(
      journal, applied, hasJournal, hasCheckpoint, Number(unfinished[0].count), parityIndex,
    );
    add('database_migrations', migrations.status, migrations.evidence);
    add('migration_0020_journal', parityMigration.status, parityMigration.evidence);
    phase = 'schema_metadata';
    const metadata = {};
    for (const [name, query] of Object.entries(metadataQueries)) {
      const [rows] = await connection.query(query);
      metadata[name] = rows;
    }
    schemaMetadata = metadata;
    if (orderId) {
      phase = 'approved_order_diagnostics';
      const [rows] = await connection.execute(
        "SELECT a.status AS attempt_status, a.updated_at AS updated_at FROM orders o JOIN checkout_payment_attempts a ON a.order_id=o.id WHERE o.id=? AND o.order_number LIKE 'SBX-%' AND o.voucher_id IS NOT NULL AND a.mode='sandbox' LIMIT 2", [orderId]);
      const status = rows.length === 1 && ['reserved','requesting','needs_reconciliation','ready','paid','expired','failed'].includes(rows[0].attempt_status)
        ? rows[0].attempt_status : null;
      add('reconciliation_diagnostics', status ? 'PASS' : 'UNVERIFIED', { attemptStatus: status, matches: rows.length });
    }
  } catch {
    add('database_probe_execution', 'UNVERIFIED', phase);
  } finally {
    if (connection) {
      await connection.rollback().catch(() => {});
      await connection.end().catch(() => {});
    }
    for (const name of ['staging_database_guard', 'database_connectivity', 'database_migrations', 'migration_0020_journal', 'reconciliation_diagnostics']) {
      if (!checks.some(row => row.check === name)) add(name, 'UNVERIFIED', null);
    }
    console.log(JSON.stringify({ checks, schemaMetadata }));
  }
}
void main();
`;

let journal: { hash: string; timestamp: number }[];
let parityIndex: number;
try {
  journal = readMigrationFiles({ migrationsFolder }).map(({ hash, folderMillis }) => ({ hash, timestamp: folderMillis }));
  const journalMetadata = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, 'utf8')) as {
    entries: { tag: string }[];
  };
  parityIndex = journalMetadata.entries.findIndex(entry => entry.tag === '0020_runtime_schema_parity');
  if (!journal[parityIndex]) throw new Error('Missing schema parity migration');
} catch {
  report('migration_0020_journal', 'FAIL', 'invalid_checkout_migration_history');
  process.exit(1);
}
const output = docker(['exec', app.id, 'node', '-e', probe, JSON.stringify(journal),
  JSON.stringify(mysqlSchemaMetadataQueries), approvedOrderId ?? '', sharedAddresses[0], String(parityIndex)]);
type ProbeResult = {
  checks: { check: string; status: Status; evidence: unknown }[];
  schemaMetadata?: Parameters<typeof normalizeMysqlSchemaInventory>[0];
};
let result: ProbeResult | undefined;
try {
  if (output) result = JSON.parse(output) as ProbeResult;
} catch {
  // A failed runtime probe does not prove its checks.
}
if (Array.isArray(result?.checks)) {
  for (const row of result.checks) report(row.check, row.status, row.evidence);
} else {
  for (const check of ['application_environment', 'payment_mode', 'voucher_feature_flags', 'shipping_rate_mode', 'webhook_readiness',
    'staging_database_guard', 'database_connectivity', 'database_migrations', 'migration_0020_journal', 'reconciliation_diagnostics']) report(check, 'UNVERIFIED', null);
}
if (result?.schemaMetadata) {
  const missing = missingMysqlSchema(normalizeMysqlSchemaInventory(result.schemaMetadata));
  const counts = Object.fromEntries(Object.entries(missing).map(([kind, objects]) => [kind, objects.length]));
  report('database_schema', Object.values(counts).every(count => count === 0) ? 'PASS' : 'FAIL', counts);
} else {
  report('database_schema', 'UNVERIFIED', null);
}

const logs = spawnSync('docker', [...localDocker, 'logs', '--since', '30m', '--tail', '500', app.id],
  { encoding: 'utf8', timeout: 10_000, maxBuffer: 2_000_000, env: dockerEnv });
const events = ['sandbox_invoice_setup', 'sandbox_settlement', 'sandbox_cancellation', 'sandbox_invoice_recovery'];
const counts = logs.status === 0
  ? Object.fromEntries(events.map(event => [event, (logs.stdout + logs.stderr).split('\n').filter(line => line.startsWith(event + ' ')).length]))
  : null;
report('structured_logs', counts && Object.values(counts).some(count => count > 0) ? 'PASS' : 'UNVERIFIED',
  { counts, redactionReviewRequired: true });
