// Dedicated local test server only. Each run owns a disposable database, never application tables.
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mysql, { type Connection, type Pool, type RowDataPacket } from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { SalesEventInput } from "@/lib/sales-events";

const runtime = vi.hoisted(() => ({ db: undefined as unknown, adminAllowed: true, operatorId: 2 }));
vi.mock("@/lib/db", () => ({ get db() { return runtime.db; } }));
vi.mock("@/lib/pos-auth", () => ({
  requirePosAdmin: async () => runtime.adminAllowed ? { ok: true, actor: { id: 1, name: "Admin", role: "admin" } } : { ok: false, error: "Forbidden" },
  requirePosOperator: async () => ({ ok: true, actor: { id: runtime.operatorId, name: "Kasir", role: "cashier" } }),
  canAccessPosSession: (actor: { id: number; role: string }, owner: number) => actor.role === "admin" || actor.id === owner,
}));

import { createSalesEvent, getActiveSalesEvents, getSalesEventsAdminData, updateSalesEvent } from "@/app/actions/sales-events";
import { closeSession, getActiveSession, getSessionSummary, openSession } from "@/app/actions/pos-sessions";

const databaseUrl = process.env.POS_REPORT_TEST_DATABASE_URL;
const database = `pos_report_test_events_${randomUUID().replaceAll("-", "")}`;
let connection: Connection;
let pool: Pool;
let db: MySql2Database<typeof schema>;
let migrationFolder: string;
let createdDatabase = false;
let preservedLegacy = false;
const eventInput = { code: "BAZAR-BDG", name: "Bazar Bandung", startsAt: "2001-01-01T00:00:00", endsAt: "2037-01-01T00:00:00", status: "active" as const, inventoryLocationId: 7 };

describe.skipIf(!databaseUrl)("sales event migration and actions on MySQL", () => {
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.startsWith("/pos_report_test")) throw new Error("Requires a dedicated local pos_report_test database");
    const options = { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), timezone: "Z" };
    connection = await mysql.createConnection(options);
    await connection.query("CREATE DATABASE ??", [database]);
    createdDatabase = true;
    await connection.changeUser({ database });
    await connection.query("SET time_zone = '+00:00'");
    const tables = [
      "users (id INT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), role VARCHAR(20), deleted_at TIMESTAMP NULL)",
      "inventory_locations (id INT PRIMARY KEY, code VARCHAR(50), name VARCHAR(150), type VARCHAR(20), is_active BOOLEAN)",
      `pos_sessions (id INT AUTO_INCREMENT PRIMARY KEY, cashier_id INT NOT NULL, location_id INT NOT NULL,
        opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TIMESTAMP NULL, opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
        closing_cash DECIMAL(12,2), expected_cash DECIMAL(12,2), cash_difference DECIMAL(12,2),
        pos_session_status ENUM('open','closed') NOT NULL DEFAULT 'open', assigned_cashier_name VARCHAR(150), notes VARCHAR(500))`,
      `orders (id INT PRIMARY KEY, pos_session_id INT, ${connection.escapeId(schema.orders.channel.name)} ${schema.orders.channel.getSQLType()},
        total DECIMAL(12,2), discount_amount DECIMAL(12,2), pos_payment_method VARCHAR(20))`,
      "pos_returns (id INT PRIMARY KEY, pos_session_id INT, refund_method VARCHAR(20), refund_amount DECIMAL(12,2))",
    ];
    for (const table of tables) await connection.query(`CREATE TABLE ${table}`);
    await connection.query("INSERT INTO users VALUES (1,'Admin','admin@test.invalid','admin',NULL),(2,'Kasir A','a@test.invalid','cashier',NULL),(3,'Kasir B','b@test.invalid','cashier',NULL)");
    await connection.query("INSERT INTO inventory_locations VALUES (7,'POS-A','POS A','pos',true),(8,'POS-B','POS B','pos',true),(9,'WH','Warehouse','warehouse',true),(10,'OLD','Old POS','pos',false)");
    await connection.query("INSERT INTO pos_sessions (id,cashier_id,location_id,pos_session_status,opening_cash,assigned_cashier_name) VALUES (20,2,7,'closed',10000,'Kasir A')");
    await connection.query("INSERT INTO orders VALUES (100,20,'pos',500000,0,'cash')");
    const [oldSessions] = await connection.query<RowDataPacket[]>("SELECT * FROM pos_sessions");
    const [oldOrders] = await connection.query<RowDataPacket[]>("SELECT * FROM orders");

    // Use the real versioned SQL and journal entry through Drizzle's migration runner.
    migrationFolder = await mkdtemp(join(tmpdir(), "onetone-event-migration-"));
    await mkdir(join(migrationFolder, "meta"));
    const journal = JSON.parse(await readFile("lib/db/migrations/meta/_journal.json", "utf8"));
    const entry = journal.entries.find((item: { tag: string }) => item.tag === "0017_sales_events");
    if (!entry) throw new Error("Missing sales event migration journal entry");
    await writeFile(join(migrationFolder, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: [entry] }));
    await writeFile(join(migrationFolder, "0017_sales_events.sql"), await readFile("lib/db/migrations/0017_sales_events.sql", "utf8"));
    await migrate(drizzle(connection), { migrationsFolder: migrationFolder });
    const [newSessions] = await connection.query<RowDataPacket[]>("SELECT * FROM pos_sessions");
    const [newOrders] = await connection.query<RowDataPacket[]>("SELECT * FROM orders");
    preservedLegacy = JSON.stringify(newOrders) === JSON.stringify(oldOrders)
      && newSessions.every((row, index) => { const { sales_event_id, ...legacy } = row; return sales_event_id === null && JSON.stringify(legacy) === JSON.stringify(oldSessions[index]); });
    pool = mysql.createPool({ ...options, database, connectionLimit: 4 });
    db = drizzle(pool, { schema, mode: "default" });
    runtime.db = db;
  }, 30000);

  afterAll(async () => {
    await pool?.end();
    try { if (createdDatabase) await connection.query("DROP DATABASE ??", [database]); }
    finally { await connection?.end(); if (migrationFolder) await rm(migrationFolder, { recursive: true, force: true }); }
  });

  beforeEach(async () => {
    runtime.adminAllowed = true;
    runtime.operatorId = 2;
    for (const table of ["pos_returns", "orders", "pos_sessions", "sales_events"]) await connection.query(`DELETE FROM ${table}`);
    await connection.query("UPDATE inventory_locations SET is_active = (id <> 10)");
    await connection.query("INSERT INTO pos_sessions (id,cashier_id,location_id,pos_session_status,opening_cash,assigned_cashier_name) VALUES (20,2,7,'closed',10000,'Kasir A')");
    await connection.query("INSERT INTO orders VALUES (100,20,'pos',500000,0,'cash')");
  });

  async function create(input: SalesEventInput = eventInput) {
    const result = await createSalesEvent(input);
    if (!result.success) throw new Error(result.error);
    return result.eventId;
  }

  it("preserves legacy data, supports old writers and does not duplicate a completed migration", async () => {
    expect(preservedLegacy).toBe(true);
    await migrate(drizzle(connection), { migrationsFolder: migrationFolder });
    const [migrations] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) count FROM __drizzle_migrations");
    expect(Number(migrations[0].count)).toBe(1);
    await connection.query("INSERT INTO pos_sessions (cashier_id,location_id,opening_cash) VALUES (3,7,5000)");
    const [sessions] = await connection.query<RowDataPacket[]>("SELECT sales_event_id FROM pos_sessions");
    expect(sessions.every(row => row.sales_event_id === null)).toBe(true);
    const [columns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM orders");
    expect(columns.map(row => row.Field)).not.toContain("sales_event_id");
  });

  it("matches the application's new table columns and indexes exactly", async () => {
    const [columns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM sales_events");
    const { getTableColumns } = await import("drizzle-orm");
    expect(columns.map(row => row.Field).sort()).toEqual(Object.values(getTableColumns(schema.salesEvents)).map(column => column.name).sort());
    const [indexes] = await connection.query<RowDataPacket[]>("SHOW INDEX FROM pos_sessions");
    expect(indexes.map(row => row.Key_name)).toContain("pos_sessions_sales_event_idx");
  });

  it("creates, selects and lists events using real physical columns", async () => {
    const id = await create();
    expect(await getActiveSalesEvents()).toEqual([expect.objectContaining({ id, inventoryLocationId: 7 })]);
    const listing = await getSalesEventsAdminData();
    expect(listing?.events[0]).toMatchObject({ event: { id, createdByUserId: 1 }, locationName: "POS A", sessionCount: 0, openSessions: 0 });
    expect(listing?.total).toBe(1);
    expect((await createSalesEvent(eventInput)).success).toBe(false);
  });

  it("excludes draft, future, expired and cancelled events from the POS selector", async () => {
    await create({ ...eventInput, code: "DRAFT", status: "draft" });
    await create({ ...eventInput, code: "FUTURE", startsAt: "2036-01-01T00:00:00" });
    await create({ ...eventInput, code: "EXPIRED", endsAt: "2002-01-01T00:00:00" });
    const cancelled = await create({ ...eventInput, code: "CANCELLED" });
    expect((await updateSalesEvent(cancelled, { ...eventInput, code: "CANCELLED", status: "cancelled" })).success).toBe(true);
    expect(await getActiveSalesEvents()).toEqual([]);
  });

  it("rejects warehouse and inactive default POS locations", async () => {
    for (const inventoryLocationId of [9, 10, 999]) expect((await createSalesEvent({ ...eventInput, inventoryLocationId })).success).toBe(false);
    expect((await getSalesEventsAdminData())?.total).toBe(0);
  });

  it("attributes only the session, allows a different stock location, and keeps regular sessions valid", async () => {
    const id = await create();
    const opened = await openSession({ locationId: 8, salesEventId: id, openingCash: 10000 });
    expect(opened.success).toBe(true);
    const active = await getActiveSession();
    expect(active).toMatchObject({ cashierId: 2, locationId: 8, salesEventId: id, salesEvent: { id, name: eventInput.name } });
    expect((await getSalesEventsAdminData())?.events[0]).toMatchObject({ sessionCount: 1, openSessions: 1 });
    runtime.operatorId = 3;
    expect((await openSession({ locationId: 7, openingCash: 0 })).success).toBe(true);
    expect(await getActiveSession()).toMatchObject({ salesEventId: null, salesEvent: null });
  });

  it("freezes used event details, blocks completion with open sessions, and preserves Z-report close semantics", async () => {
    const id = await create();
    const opened = await openSession({ locationId: 7, salesEventId: id, openingCash: 10000 });
    if (!opened.success || !opened.sessionId) throw new Error(opened.error);
    expect((await updateSalesEvent(id, { ...eventInput, name: "Changed" })).success).toBe(false);
    expect((await updateSalesEvent(id, { ...eventInput, status: "closed" })).success).toBe(false);
    await connection.query("INSERT INTO orders VALUES (101,?,'pos',500000,0,'cash')", [opened.sessionId]);
    await connection.query("INSERT INTO pos_returns VALUES (1,?,'cash',100000)", [opened.sessionId]);
    expect(await getSessionSummary(opened.sessionId)).toMatchObject({ expectedCash: 410000, totalSales: 400000, totalRefunds: 100000, salesEvent: { id } });
    expect((await closeSession({ sessionId: opened.sessionId, closingCash: 410000 })).success).toBe(true);
    const [closed] = await db.select().from(schema.posSessions).where(eq(schema.posSessions.id, opened.sessionId));
    expect(closed).toMatchObject({ status: "closed", cashDifference: "0.00", salesEventId: id });
    expect((await updateSalesEvent(id, { ...eventInput, status: "closed" })).success).toBe(true);
    expect((await updateSalesEvent(id, eventInput)).success).toBe(false);
    expect((await openSession({ locationId: 7, salesEventId: id, openingCash: 0 })).success).toBe(false);
  });

  it("serializes simultaneous openings for the same owner", async () => {
    const id = await create();
    const results = await Promise.all([openSession({ locationId: 7, salesEventId: id, openingCash: 0 }), openSession({ locationId: 7, salesEventId: id, openingCash: 0 })]);
    expect(results.filter(result => result.success)).toHaveLength(1);
    expect(results.filter(result => !result.success)).toHaveLength(1);
  });

  it("coordinates event cancellation and new sessions without orphaned active sessions", async () => {
    const id = await create();
    const [opened, cancelled] = await Promise.all([openSession({ locationId: 7, salesEventId: id, openingCash: 0 }), updateSalesEvent(id, { ...eventInput, status: "cancelled" })]);
    expect(Number(opened.success) + Number(cancelled.success)).toBe(1);
    const [event] = await db.select().from(schema.salesEvents).where(eq(schema.salesEvents.id, id));
    expect(event.status).toBe(opened.success ? "active" : "cancelled");
  });

  it("enforces foreign keys without deleting historical attribution", async () => {
    const id = await create();
    expect((await openSession({ locationId: 7, salesEventId: id, openingCash: 0 })).success).toBe(true);
    await expect(connection.query("DELETE FROM sales_events WHERE id = ?", [id])).rejects.toMatchObject({ code: "ER_ROW_IS_REFERENCED_2" });
    await expect(connection.query("UPDATE pos_sessions SET sales_event_id = 999999 WHERE id = 20")).rejects.toMatchObject({ code: "ER_NO_REFERENCED_ROW_2" });
  });

  it("denies cashier access to event administration", async () => {
    runtime.adminAllowed = false;
    expect((await createSalesEvent(eventInput)).success).toBe(false);
    expect(await getSalesEventsAdminData()).toBeNull();
  });
});
