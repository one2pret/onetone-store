import type { MigrationMeta } from 'drizzle-orm/migrator';
import type { Connection } from 'mysql2/promise';
import additions from '../lib/db/mysql-0020-schema-additions.json';
import { loadMysqlSchemaContract, missingMysqlSchema, readMysqlSchemaInventory } from './mysql-schema-parity';
import { isStagingDatabaseUrl } from './staging-preflight-target';

export type LegacyBaselineTarget = 'staging' | 'clone';
type JournalRow = { hash: string; created_at: number | string | null };

export function assertLegacyBaselineTarget(url: URL, target: LegacyBaselineTarget) {
  const allowed = target === 'staging' ? isStagingDatabaseUrl(url.href) :
    url.protocol === 'mysql:' && url.hostname === '127.0.0.1' && Boolean(url.port) &&
    /^\/onetone_rc_clone_[a-z0-9_]+$/.test(url.pathname) && !url.search && !url.hash;
  if (!allowed) throw new Error('Legacy migration requires an approved staging target or disposable loopback clone');
}

const baseline = { hash: 'baseline-manual-through-0015', timestamp: 1790704800000 };
const reviewedFiles = [
  { timestamp: 1790816400000, hash: '648068167b39d7deae50b7d253956e7864a54f90245cef108fdd0c04b991a5ab' },
  { timestamp: 1791766800000, hash: '55e97cf3d64826815b06b208d71bfab5ae495cad6cecbc35e46c15254ffce6e4' },
  { timestamp: 1794528000000, hash: '8d7c6f64835ee380a32ee06a67c46a609f9f98936f95cefe62a77f6af37b17f4' },
  { timestamp: 1795071600000, hash: 'a11e6fef202424c5fbf7448dd5e5770c12500feb404567680118609050742c95' },
  { timestamp: 1795305600000, hash: '513227c7445189cb01c2ee905df1e65c83558b66a45d4914ae291d287f020fbf' },
];
export const reviewedLegacyHistory = [baseline, ...reviewedFiles];

export function matchLegacyBaseline(journal: readonly JournalRow[], migrations: readonly MigrationMeta[]) {
  if (migrations.length !== 21 || !reviewedFiles.every((file, index) =>
    file.hash === migrations[index + 16].hash && file.timestamp === migrations[index + 16].folderMillis) ||
    (journal.length !== 5 && journal.length !== 6) ||
    !journal.every((row, index) => row.hash === reviewedLegacyHistory[index].hash &&
      Number(row.created_at) === reviewedLegacyHistory[index].timestamp)) {
    throw new Error('Journal is not the exact reviewed staging legacy baseline');
  }
  return journal.length === 6 ? 21 : 20;
}

export async function assertLegacySchema(connection: Connection, parityApplied: boolean) {
  const expected = loadMysqlSchemaContract();
  const actual = await readMysqlSchemaInventory(connection);
  if (!parityApplied) {
    const existingNames = new Set(actual.columns.map(signature => JSON.parse(signature)[0]));
    const actualColumns = new Set(actual.columns);
    // IF NOT EXISTS does not repair a column that exists with the wrong definition.
    if (additions.columns.some(signature =>
      existingNames.has(JSON.parse(signature)[0]) && !actualColumns.has(signature))) {
      throw new Error('Existing migration 0020 column is incompatible with the reviewed schema');
    }
    for (const kind of Object.keys(expected) as (keyof typeof expected)[]) {
      const pending = new Set(additions[kind]);
      expected[kind] = expected[kind].filter(signature => !pending.has(signature));
    }
  }
  if (Object.values(missingMysqlSchema(actual, expected)).some(items => items.length)) {
    throw new Error(parityApplied ? 'Migration 0020 failed schema parity' : 'Legacy schema fails the pre-0020 contract');
  }
}
