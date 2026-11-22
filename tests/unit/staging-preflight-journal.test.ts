import { runInNewContext } from 'node:vm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { describe, expect, it } from 'vitest';
import { migrationsFolder } from '../../scripts/mysql-migrations';
import { diagnoseStagingJournal } from '../../scripts/staging-preflight-journal';

const expected = readMigrationFiles({ migrationsFolder }).map(({ hash, folderMillis }) => ({ hash, timestamp: folderMillis }));
const applied = expected.map(({ hash, timestamp }) => ({ hash, created_at: String(timestamp) }));
const parityIndex = expected.findIndex(row => row.timestamp === 1795305600000);

describe('staging migration evidence', () => {
  it('recognizes five genuine journal records and identifies the first of sixteen unverified migrations', () => {
    const embeddedProbe: typeof diagnoseStagingJournal = runInNewContext(`(${diagnoseStagingJournal.toString()})`);
    const { migrations, parityMigration } = embeddedProbe(expected, applied.slice(0, 5), true, true, 0, parityIndex);
    expect(migrations).toMatchObject({
      status: 'FAIL',
      evidence: { history: 'incomplete_prefix', applied: 5, expected: 21, verifiedPrefixLength: 5, firstUnverifiedIndex: 5 },
    });
    expect(parityMigration).toEqual({
      status: 'FAIL', evidence: { matchingTimestampOrHashRows: 0, recordedInVerifiedPrefix: false },
    });
  });

  it('distinguishes an incompatible history of the same length', () => {
    const rows = applied.slice(0, 5);
    rows[2] = { ...rows[2], hash: 'unexpected' };
    expect(diagnoseStagingJournal(expected, rows, true, true, 0, parityIndex).migrations).toMatchObject({
      status: 'FAIL', evidence: { history: 'history_mismatch', verifiedPrefixLength: 2, firstUnverifiedIndex: 2 },
    });
  });

  it('requires a complete verified history and a clean checkpoint', () => {
    expect(diagnoseStagingJournal(expected, applied, true, true, 0, parityIndex)).toMatchObject({
      migrations: { status: 'PASS', evidence: { history: 'complete', firstUnverifiedIndex: null } },
      parityMigration: { status: 'PASS' },
    });
    expect(diagnoseStagingJournal(expected, applied, true, true, 1, parityIndex).migrations.status).toBe('FAIL');
    expect(diagnoseStagingJournal(expected, applied, true, false, 0, parityIndex).migrations.status).toBe('UNVERIFIED');
  });

  it('rejects a standalone, altered, or duplicate migration 0020 record', () => {
    const altered = { ...applied[parityIndex], hash: 'unexpected' };
    const fixtures = [[applied[parityIndex]], [...applied.slice(0, parityIndex), altered], [...applied, applied[parityIndex]]];
    for (const rows of fixtures) {
      expect(diagnoseStagingJournal(expected, rows, true, true, 0, parityIndex).parityMigration.status).toBe('FAIL');
    }
  });

  it('distinguishes a missing journal from an empty existing journal', () => {
    expect(diagnoseStagingJournal(expected, [], false, false, 0, parityIndex)).toMatchObject({
      migrations: { status: 'FAIL', evidence: { history: 'missing_journal' } }, parityMigration: { status: 'UNVERIFIED' },
    });
    expect(diagnoseStagingJournal(expected, [], true, false, 0, parityIndex)).toMatchObject({
      migrations: { status: 'FAIL', evidence: { history: 'empty_journal' } }, parityMigration: { status: 'FAIL' },
    });
  });
});
