import { describe, expect, it } from 'vitest';
import { isStagingDatabaseUrl } from '../../scripts/staging-preflight-target';

describe('staging database allowlist', () => {
  it('accepts the approved Compose database only', () => {
    expect(isStagingDatabaseUrl('mysql://fixture:fixture@onetone-db/onetone_db')).toBe(true);
    expect(isStagingDatabaseUrl('mysql://fixture:fixture@onetone-db:3306/onetone_db')).toBe(true);
  });

  it.each([
    undefined,
    'mysql://fixture:fixture@production.example.test/onetone_db',
    'mysql://fixture:fixture@onetone-db/production',
    'mysql://fixture:fixture@127.0.0.1/onetone_db',
    'mysql://fixture:fixture@onetone-db:3307/onetone_db',
    'mysql://fixture:fixture@onetone-db/onetone_db?socketPath=/tmp/mysql.sock',
    'mysql://fixture:fixture@onetone-db/onetone_db?multipleStatements=true',
    'https://fixture:fixture@onetone-db/onetone_db',
    'mysql://onetone-db/onetone_db',
  ])('blocks an unapproved target (%s)', (url) => {
    expect(isStagingDatabaseUrl(url)).toBe(false);
  });
});
