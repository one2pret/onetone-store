export const stagingHost = 'VM-7-242-ubuntu';
export const stagingComposeFile = '/opt/onetone-store/docker-compose.yml';

export function isStagingDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'mysql:' && url.hostname === 'onetone-db' &&
      (url.port === '' || url.port === '3306') && url.pathname === '/onetone_db' &&
      url.search === '' && url.hash === '' && url.username.length > 0;
  } catch {
    return false;
  }
}
