import { readFileSync } from 'node:fs';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';

type SchemaInventory = Record<'columns' | 'indexes' | 'foreignKeys' | 'checks', string[]>;
const contractPath = 'lib/db/mysql-runtime-schema.json';

type Column = RowDataPacket & {
  t: string; n: string; ty: string; nu: 'YES' | 'NO'; d: string | null; e: string;
};

function columnSignature(row: Column) {
  const name = row.t + '.' + row.n;
  // Published migrations use equivalent storage for these fields. Keep both
  // deployed variants readable without rewriting historical columns or data.
  const type = name === 'checkout_payment_attempts.request_hash' && row.ty === 'char(64)'
    ? 'varchar(64)' : row.ty;
  const nullable = name === 'order_items.manual_discount_amount' || name === 'order_items.product_discount_amount'
    ? 'YES' : row.nu;
  const defaultValue = row.d && row.ty.startsWith('timestamp') && /^(now\(\)|current_timestamp(\(\))?)$/i.test(row.d)
    ? 'CURRENT_TIMESTAMP' : row.d;
  return JSON.stringify([name, type, nullable, defaultValue, row.e]);
}

function signatureGroups(rows: RowDataPacket[], values: (row: RowDataPacket) => unknown[]) {
  const groups = new Map<string, { table: string; values: unknown[][] }>();
  for (const row of rows) {
    const key = row.t + '\0' + row.n;
    const group = groups.get(key) ?? { table: row.t, values: [] as unknown[][] };
    group.values.push(values(row));
    groups.set(key, group);
  }
  return [...new Set([...groups.values()].map(group => JSON.stringify([group.table, ...group.values])))].sort();
}

export async function readMysqlSchemaInventory(connection: Connection): Promise<SchemaInventory> {
  const [columns] = await connection.query<Column[]>(`SELECT TABLE_NAME t, COLUMN_NAME n, COLUMN_TYPE ty,
    IS_NULLABLE nu, COLUMN_DEFAULT d, EXTRA e FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()`);
  const [indexes] = await connection.query<RowDataPacket[]>(`SELECT TABLE_NAME t, INDEX_NAME n,
    NON_UNIQUE u, COLUMN_NAME c, SUB_PART p, INDEX_TYPE ty, COLLATION dir, IS_VISIBLE v
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ORDER BY t,n,SEQ_IN_INDEX`);
  const [foreignKeys] = await connection.query<RowDataPacket[]>(`SELECT k.TABLE_NAME t, k.CONSTRAINT_NAME n,
    k.COLUMN_NAME c, k.REFERENCED_TABLE_NAME rt, k.REFERENCED_COLUMN_NAME rc,
    (k.REFERENCED_TABLE_SCHEMA = DATABASE()) local_schema, r.UPDATE_RULE ur, r.DELETE_RULE dr
    FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME
    WHERE k.TABLE_SCHEMA=DATABASE() ORDER BY t,n,k.ORDINAL_POSITION`);
  const [checks] = await connection.query<RowDataPacket[]>(`SELECT t.TABLE_NAME t, c.CHECK_CLAUSE clause
    FROM information_schema.TABLE_CONSTRAINTS t JOIN information_schema.CHECK_CONSTRAINTS c
    ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME
    WHERE t.TABLE_SCHEMA=DATABASE() AND t.CONSTRAINT_TYPE='CHECK' AND t.ENFORCED='YES'`);

  return {
    columns: columns.map(columnSignature).sort(),
    indexes: signatureGroups(indexes, row => [row.n === 'PRIMARY', row.u, row.c, row.p, row.ty, row.dir, row.v]),
    foreignKeys: signatureGroups(foreignKeys, row => [row.c, row.rt, row.rc, Number(row.local_schema), row.ur, row.dr]),
    checks: checks.map(row => JSON.stringify([row.t, row.clause])).sort(),
  };
}

export function loadMysqlSchemaContract(): SchemaInventory {
  return JSON.parse(readFileSync(contractPath, 'utf8')) as SchemaInventory;
}

/** Required signatures must be present. Retain unknown and managed objects
 * for review without modifying them or silently treating them as required. */
export function missingMysqlSchema(actual: SchemaInventory, expected = loadMysqlSchemaContract()) {
  return Object.fromEntries(Object.entries(expected).map(([kind, signatures]) => {
    const present = new Set(actual[kind as keyof SchemaInventory]);
    return [kind, signatures.filter(signature => !present.has(signature)).map(signature => JSON.parse(signature))];
  }));
}

export async function verifyMysqlRuntimeSchema(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:' || url.pathname.length < 2) throw new Error('MySQL database required');
  const connection = await mysql.createConnection({ uri: databaseUrl, connectTimeout: 5000 });
  try {
    const missing = missingMysqlSchema(await readMysqlSchemaInventory(connection));
    const pass = Object.values(missing).every(items => items.length === 0);
    return { check: 'mysql_runtime_schema', status: pass ? 'PASS' : 'FAIL', missing };
  } finally {
    await connection.end();
  }
}
