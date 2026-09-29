// lib/db/index.ts
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const dbUrl = new URL(process.env.DATABASE_URL!);

type MysqlPool = ReturnType<typeof mysql.createPool>;
type MysqlCoreConnection = { query: (statement: string) => unknown };
type MysqlCorePool = {
  on: (event: 'connection', listener: (connection: MysqlCoreConnection) => void) => void;
};

const globalForDb = globalThis as typeof globalThis & {
  __onetoneMysqlPool?: MysqlPool;
};

const configuredConnectionLimit = Number.parseInt(process.env.DB_CONNECTION_LIMIT ?? '10', 10);
const connectionLimit = Number.isInteger(configuredConnectionLimit) && configuredConnectionLimit > 0
  ? configuredConnectionLimit
  : 10;

function createMysqlPool(): MysqlPool {
  const pool = mysql.createPool({
    host: dbUrl.hostname,
    port: Number(dbUrl.port) || 3306,
    user: dbUrl.username,
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.slice(1),
    waitForConnections: true,
    connectionLimit,
    // Drizzle ORM hardcodes "+0000" when parsing TIMESTAMP/DATETIME values
    // (see node_modules/drizzle-orm/mysql-core/columns/timestamp.js mapFromDriverValue).
    // This means Drizzle always treats MySQL datetime strings as UTC.
    // We set timezone to 'Z' so mysql2 also treats values as UTC for consistency.
    timezone: 'Z',
  });

  // Pasang listener sekali saat pool dibuat. Jika diletakkan di luar fungsi,
  // Turbopack HMR akan menambahkan listener baru pada pool singleton yang sama.
  const corePool = (pool as unknown as { pool: MysqlCorePool }).pool;
  corePool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });

  return pool;
}

// Turbopack mengevaluasi ulang modul saat development. Simpan pool di globalThis
// agar hot reload tidak meninggalkan banyak pool (masing-masing hingga 10 koneksi).
const poolConnection = globalForDb.__onetoneMysqlPool ?? createMysqlPool();
if (process.env.NODE_ENV !== 'production') {
  globalForDb.__onetoneMysqlPool = poolConnection;
}

// Force every new pool connection to use UTC session timezone.
// MySQL TIMESTAMP is stored as UTC internally and converted to session timezone on read/write.
// By setting session to UTC, MySQL returns raw UTC strings matching Drizzle's "+0000" assumption.
// Listener dipasang di createMysqlPool() agar hanya terdaftar satu kali per pool.

export const db = drizzle(poolConnection, {
  schema,
  mode: 'default'
});
