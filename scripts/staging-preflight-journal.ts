type Migration = { hash: string; timestamp: number; tag?: string };
type JournalRow = { hash: string; created_at: number | string | null };

export function diagnoseStagingJournal(
  expected: readonly Migration[],
  applied: readonly JournalRow[],
  hasJournal: boolean,
  hasCheckpoint: boolean,
  unfinished: number,
  parityIndex: number,
  reviewedLegacy: readonly Migration[] = [],
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
  const legacyFilesMatch = reviewedLegacy.length > 1 && expected.length === 21 &&
    reviewedLegacy.slice(1).every((row, index) =>
      row.hash === expected[index + 16].hash && row.timestamp === expected[index + 16].timestamp);
  const followsReview = legacyFilesMatch &&
    (applied.length === reviewedLegacy.length || applied.length === reviewedLegacy.length - 1) &&
    applied.every((row, index) => row.hash === reviewedLegacy[index].hash &&
      Number(row.created_at) === reviewedLegacy[index].timestamp);
  const legacyState = !followsReview ? null :
    applied.length === reviewedLegacy.length ? 'complete' : '0020_pending';
  const parityRecorded = (verifiedPrefixLength > parityIndex || legacyState === 'complete') && parityRows.length === 1;
  const comparison = applied.map((row, index) => {
    const positional = expected[index];
    const timestamp = row.created_at === null ? null : Number(row.created_at);
    const matchByTime = expected.find(item => item.timestamp === timestamp);
    const matchByHash = expected.find(item => item.hash === row.hash);
    const legacyBaseline = row.hash === 'baseline-manual-through-0015' && timestamp === 1790704800000;
    return {
      index,
      expectedTag: positional?.tag ?? null,
      expectedTimestamp: positional?.timestamp ?? null,
      observedTimestamp: Number.isSafeInteger(timestamp) ? timestamp : null,
      timestampMatchesPosition: Boolean(positional && timestamp === positional.timestamp),
      hashMatchesPosition: Boolean(positional && row.hash === positional.hash),
      tagAtObservedTimestamp: matchByTime?.tag ?? null,
      tagForExactHash: matchByHash?.tag ?? null,
      documentedLegacyBaseline: legacyBaseline,
    };
  });

  return {
    migrations: {
      status: (history !== 'complete' && legacyState !== 'complete') || unfinished !== 0
        ? 'FAIL' : hasCheckpoint ? 'PASS' : 'UNVERIFIED',
      evidence: {
        history,
        applied: applied.length,
        expected: expected.length,
        verifiedPrefixLength,
        firstUnverifiedIndex: verifiedPrefixLength === expected.length && history === 'complete' ? null : verifiedPrefixLength,
        unfinished,
        checkpointTable: hasCheckpoint,
        reviewedLegacyHistory: legacyState,
        comparison,
      },
    },
    parityMigration: {
      status: !hasJournal ? 'UNVERIFIED' : parityRecorded ? 'PASS' : 'FAIL',
      evidence: { matchingTimestampOrHashRows: parityRows.length,
        recordedInVerifiedPrefix: verifiedPrefixLength > parityIndex && parityRows.length === 1,
        recordedInReviewedLegacyHistory: legacyState === 'complete' },
    },
  } as const;
}
