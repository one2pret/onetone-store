// lib/db/index.ts
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

const dbUrl = new URL(process.env.DATABASE_URL!);

const poolConnection = mysql.createPool({
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  waitForConnections: true,
  connectionLimit: 10,
  // Drizzle ORM hardcodes "+0000" when parsing TIMESTAMP/DATETIME values
  // (see node_modules/drizzle-orm/mysql-core/columns/timestamp.js mapFromDriverValue).
  // This means Drizzle always treats MySQL datetime strings as UTC.
  // We set timezone to 'Z' so mysql2 also treats values as UTC for consistency.
  timezone: 'Z',
});

// Force every new pool connection to use UTC session timezone.
// MySQL TIMESTAMP is stored as UTC internally and converted to session timezone on read/write.
// By setting session to UTC, MySQL returns raw UTC strings matching Drizzle's "+0000" assumption.
// Access the underlying core pool to attach the event listener.
const corePool = (poolConnection as any).pool;
corePool.on('connection', (connection: any) => {
  connection.query("SET time_zone = '+00:00'");
});

export const db = drizzle(poolConnection, {
  schema,
  mode: 'default'
});
