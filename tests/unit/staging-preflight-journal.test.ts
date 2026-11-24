import { runInNewContext } from 'node:vm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { describe, expect, it } from 'vitest';
import { migrationsFolder } from '../../scripts/mysql-migrations';
import { diagnoseStagingJournal } from '../../scripts/staging-preflight-journal';
import { reviewedLegacyHistory } from '../../scripts/mysql-legacy-baseline';
import journal from '../../lib/db/migrations/meta/_journal.json';

const expected = readMigrationFiles({ migrationsFolder }).map(({ hash, folderMillis }, index) =>
  ({ hash, timestamp: folderMillis, tag: journal.entries[index].tag }));
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
      status: 'FAIL', evidence: { matchingTimestampOrHashRows: 0, recordedInVerifiedPrefix: false, recordedInReviewedLegacyHistory: false },
    });
  });

  it('distinguishes the reviewed staging legacy history from a canonical prefix', () => {
    const legacy = reviewedLegacyHistory.map(({ hash, timestamp }) => ({ hash, created_at: String(timestamp) }));
    expect(diagnoseStagingJournal(expected, legacy.slice(0, 5), true, true, 0, parityIndex, reviewedLegacyHistory))
      .toMatchObject({ migrations: { status: 'FAIL', evidence: { reviewedLegacyHistory: '0020_pending' } } });
    expect(diagnoseStagingJournal(expected, legacy, true, true, 0, parityIndex, reviewedLegacyHistory))
      .toMatchObject({ migrations: { status: 'PASS', evidence: { history: 'history_mismatch', reviewedLegacyHistory: 'complete' } },
        parityMigration: { status: 'PASS', evidence: { recordedInVerifiedPrefix: false, recordedInReviewedLegacyHistory: true } } });
  });

  it('distinguishes an incompatible history of the same length', () => {
    const rows = applied.slice(0, 5);
    rows[2] = { ...rows[2], hash: 'unexpected' };
    expect(diagnoseStagingJournal(expected, rows, true, true, 0, parityIndex).migrations).toMatchObject({
      status: 'FAIL', evidence: { history: 'history_mismatch', verifiedPrefixLength: 2, firstUnverifiedIndex: 2 },
    });
  });

  it('maps a documented legacy marker and four subsequent rows without exposing unrecognized hashes', () => {
    const rows = [
      { hash: 'baseline-manual-through-0015', created_at: '1790704800000' },
      ...applied.slice(16, 19),
      { ...applied[19], hash: 'unrecognized-journal-value' },
    ];
    const { migrations } = diagnoseStagingJournal(expected, rows, true, true, 0, parityIndex);
    expect(migrations.evidence.verifiedPrefixLength).toBe(0);
    expect(migrations.evidence.comparison).toMatchObject([
      { index: 0, expectedTag: journal.entries[0].tag, expectedTimestamp: 1784002757594,
        observedTimestamp: 1790704800000, tagAtObservedTimestamp: journal.entries[15].tag,
        tagForExactHash: null, documentedLegacyBaseline: true, hashMatchesPosition: false, timestampMatchesPosition: false },
      ...journal.entries.slice(16, 19).map(({ tag }) => ({ tagAtObservedTimestamp: tag, tagForExactHash: tag })),
      { observedTimestamp: 1795071600000, tagAtObservedTimestamp: journal.entries[19].tag, tagForExactHash: null },
    ]);
    expect(JSON.stringify(migrations)).not.toContain('unrecognized-journal-value');
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
