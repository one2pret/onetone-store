import { verifyMysqlRuntimeSchema } from './mysql-schema-parity';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const result = await verifyMysqlRuntimeSchema(url);
  console.log(JSON.stringify(result));
  if (result.status !== 'PASS') process.exitCode = 1;
}

void main().catch(() => {
  console.log(JSON.stringify({ check: 'mysql_runtime_schema', status: 'UNVERIFIED' }));
  process.exitCode = 2;
});
