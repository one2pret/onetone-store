type Migration = { hash: string; timestamp: number };
type JournalRow = { hash: string; created_at: number | string | null };

export function diagnoseStagingJournal(
  expected: readonly Migration[],
  applied: readonly JournalRow[],
  hasJournal: boolean,
  hasCheckpoint: boolean,
  unfinished: number,
  parityIndex: number,
) {
  let verifiedPrefixLength = 0;
  while (verifiedPrefixLength < Math.min(expected.length, applied.length) &&
    applied[verifiedPrefixLength].hash === expected[verifiedPrefixLength].hash &&
    Number(applied[verifiedPrefixLength].created_at) === expected[verifiedPrefixLength].timestamp) {
    verifiedPrefixLength++;
  }

  let history;
  if (!hasJournal) history = 'missing_journal';
  else if (!applied.length) history = 'empty_journal';
  else if (verifiedPrefixLength !== applied.length) history = 'history_mismatch';
  else if (applied.length < expected.length) history = 'incomplete_prefix';
  else history = 'complete';

  const parity = expected[parityIndex];
  const parityRows = applied.filter(row => Number(row.created_at) === parity.timestamp || row.hash === parity.hash);
  const parityRecorded = verifiedPrefixLength > parityIndex && parityRows.length === 1;

  return {
    migrations: {
      status: history !== 'complete' || unfinished !== 0 ? 'FAIL' : hasCheckpoint ? 'PASS' : 'UNVERIFIED',
      evidence: {
        history,
        applied: applied.length,
        expected: expected.length,
        verifiedPrefixLength,
        firstUnverifiedIndex: verifiedPrefixLength === expected.length && history === 'complete' ? null : verifiedPrefixLength,
        unfinished,
        checkpointTable: hasCheckpoint,
      },
    },
    parityMigration: {
      status: !hasJournal ? 'UNVERIFIED' : parityRecorded ? 'PASS' : 'FAIL',
      evidence: { matchingTimestampOrHashRows: parityRows.length, recordedInVerifiedPrefix: parityRecorded },
    },
  } as const;
}
