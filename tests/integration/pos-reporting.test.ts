// Opt in with a local test server. Every run creates and removes its own database; application tables are never used.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableColumns, getTableName } from "drizzle-orm";
import { users, posSessions, orders, orderItems, posReturns, posReturnItems } from "@/lib/db/schema";
import { buildCashierReportQualityQuery, buildCashierReportQuery } from "@/lib/pos-reporting-queries";
import { parseCashierReportFilters } from "@/lib/pos-reporting";
import { buildEventReportQualityQuery, buildEventSalesReportQuery } from "@/lib/pos-event-reporting";

const databaseUrl = process.env.POS_REPORT_TEST_DATABASE_URL;
let connection: Connection;
const testDatabase = `pos_report_test_${randomUUID().replaceAll("-", "")}`;
let createdTestDatabase = false;

describe.skipIf(!databaseUrl)("POS report SQL on MySQL", () => {
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.startsWith("/pos_report_test")) {
      throw new Error("Reporting integration tests require a dedicated local pos_report_test database");
    }
    connection = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306),
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), timezone: "Z" });
    await connection.query("CREATE DATABASE ??", [testDatabase]);
    createdTestDatabase = true;
    await connection.changeUser({ database: testDatabase });
    await connection.query("SET time_zone = '+00:00'");
    const definitions = [
      "users (id INT PRIMARY KEY, name VARCHAR(255), deleted_at TIMESTAMP NULL)",
      "pos_sessions (id INT PRIMARY KEY, cashier_id INT, location_id INT, opened_at TIMESTAMP NULL, closed_at TIMESTAMP NULL, pos_session_status VARCHAR(20), cash_difference DECIMAL(12,2))",
      `orders (id INT PRIMARY KEY, pos_session_id INT, ${connection.escapeId(orders.channel.name)} ${orders.channel.getSQLType()}, status VARCHAR(20), paid_at TIMESTAMP NULL, created_at TIMESTAMP NULL, subtotal DECIMAL(12,2), discount_amount DECIMAL(12,2), total DECIMAL(12,2), pos_payment_method VARCHAR(20))`,
      "order_items (id INT PRIMARY KEY, order_id INT, quantity INT, price DECIMAL(12,2), regular_price DECIMAL(12,2))",
      "pos_returns (id INT PRIMARY KEY, order_id INT, pos_session_id INT, actor_user_id INT, created_at TIMESTAMP NULL, refund_method VARCHAR(20), refund_amount DECIMAL(12,2))",
      "pos_return_items (id INT PRIMARY KEY, return_id INT, quantity INT, restocked BOOLEAN)",
    ];
    for (const definition of definitions) await connection.query(`CREATE TABLE ${definition}`);
  });

  it("uses only physical column names declared in the application schema", async () => {
    for (const table of [users, posSessions, orders, orderItems, posReturns, posReturnItems]) {
      const [columns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM ??", [getTableName(table)]);
      const schemaColumns = new Set(Object.values(getTableColumns(table)).map(column => column.name));
      for (const column of columns) expect(schemaColumns.has(String(column.Field)), `${getTableName(table)}.${column.Field}`).toBe(true);
    }
    const [columns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM orders");
    expect(columns.map(column => column.Field)).toContain("order_channel");
    expect(columns.map(column => column.Field)).not.toContain("channel");
  });

  afterAll(async () => {
    try {
      if (createdTestDatabase) await connection.query("DROP DATABASE ??", [testDatabase]);
    } finally {
      await connection?.end();
    }
  });

  beforeEach(async () => {
    for (const table of ["pos_return_items", "pos_returns", "order_items", "orders", "pos_sessions", "users"]) {
      await connection.query(`DELETE FROM ${table}`);
    }
    await connection.query("INSERT INTO users VALUES (1,'Admin',NULL),(2,'Kasir A',NULL),(3,'Kasir B',NULL)");
    await connection.query(`INSERT INTO pos_sessions (id,cashier_id,location_id,opened_at,closed_at,pos_session_status,cash_difference) VALUES
      (20,2,7,'2026-09-29 01:00:00','2026-10-01 10:00:00','closed',5000),
      (21,3,7,'2026-10-01 01:00:00','2026-10-02 10:00:00','closed',-7000),
      (22,2,7,'2026-10-02 01:00:00','2026-10-03 10:00:00','closed',5000)`);
    await connection.query("INSERT INTO orders VALUES (100,20,'pos','delivered','2026-09-30 17:15:00','2026-09-30 17:15:00',500000,0,500000,'cash')");
    await connection.query("INSERT INTO order_items VALUES (1,100,2,100000,100000),(2,100,3,100000,100000)");
    await connection.query("INSERT INTO pos_returns VALUES (10,100,21,1,'2026-11-01 01:00:00','transfer',100000)");
    await connection.query("INSERT INTO pos_return_items VALUES (1,10,1,false)");
  });

  async function report(overrides: Parameters<typeof parseCashierReportFilters>[0] = {}, asOf = new Date("2026-11-02T00:00:00Z")) {
    const parsed = parseCashierReportFilters({ from: "2026-10-01", to: "2026-10-31", ...overrides }, asOf);
    if (!parsed.success) throw new Error(parsed.error);
    return drizzle(connection).transaction(async tx => {
      const [rawRows] = await tx.execute(buildCashierReportQuery(parsed.filters));
      const [rawQualityRows] = await tx.execute(buildCashierReportQualityQuery(parsed.filters));
      const rows = rawRows as RowDataPacket[];
      const qualityRows = rawQualityRows as RowDataPacket[];
      return { rows, summary: rows.find(row => row.rowKind === "summary")!, a: rows.find(row => Number(row.cashierId) === 2), b: rows.find(row => Number(row.cashierId) === 3), quality: qualityRows[0] };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }

  it("attributes a later admin refund to the original seller, not the refund session owner", async () => {
    const result = await report();
    expect(Number(result.a!.salesBeforeRefunds)).toBe(500000);
    expect(Number(result.a!.refunds)).toBe(100000);
    expect(Number(result.a!.netSales)).toBe(400000);
    expect(Number(result.b!.refunds)).toBe(0);
    expect(Number(result.b!.cashDifference)).toBe(-7000);
    expect(Number(result.a!.cashSales)).toBe(500000);
    expect(Number(result.a!.transferRefunds)).toBe(100000);
    expect(Number(result.a!.returnedItems)).toBe(1);
  });

  it("counts same-valued cash differences once per closed session and excludes active sessions", async () => {
    await connection.query("INSERT INTO pos_sessions (id,cashier_id,location_id,opened_at,closed_at,pos_session_status,cash_difference) VALUES (23,2,7,'2026-10-01 01:00:00',NULL,'open',123456)");
    const result = await report();
    expect(Number(result.a!.cashDifference)).toBe(10000);
    expect(Number(result.a!.closedSessionCount)).toBe(2);
    expect(Number(result.a!.salesSessionCount)).toBe(1);
  });

  it("does not multiply order amounts when there are multiple items and refunds", async () => {
    await connection.query("INSERT INTO pos_returns VALUES (11,100,NULL,1,'2026-11-01 02:00:00','qris',100000)");
    await connection.query("INSERT INTO pos_return_items VALUES (2,11,1,true)");
    const result = await report();
    expect(Number(result.a!.transactions)).toBe(1);
    expect(Number(result.a!.salesBeforeRefunds)).toBe(500000);
    expect(Number(result.a!.refunds)).toBe(200000);
    expect(Number(result.a!.itemsSold)).toBe(5);
    expect(Number(result.a!.returnedItems)).toBe(2);
    expect(Number(result.a!.netItems)).toBe(3);
  });

  it("keeps refunds after the cutoff out of the report", async () => {
    const result = await report({}, new Date("2026-10-31T00:00:00Z"));
    expect(Number(result.a!.refunds)).toBe(0);
    expect(Number(result.a!.netSales)).toBe(500000);
  });

  it("uses inclusive Jakarta days without filtering by session opening date", async () => {
    await connection.query("INSERT INTO orders VALUES (101,20,'pos','delivered','2026-09-30 16:59:59','2026-09-30 16:59:59',10000,0,10000,'cash'),(102,20,'pos','delivered','2026-10-01 17:00:00','2026-10-01 17:00:00',10000,0,10000,'cash')");
    const result = await report({ from: "2026-10-01", to: "2026-10-01" });
    expect(Number(result.a!.transactions)).toBe(1);
    expect(Number(result.a!.salesBeforeRefunds)).toBe(500000);
  });

  it("combines promo and manual/voucher discounts without counting promo twice", async () => {
    await connection.query("UPDATE orders SET subtotal=450000, discount_amount=50000, total=400000 WHERE id=100");
    await connection.query("DELETE FROM order_items");
    await connection.query("INSERT INTO order_items VALUES (1,100,2,225000,300000)");
    const result = await report();
    expect(Number(result.a!.grossSales)).toBe(600000);
    expect(Number(result.a!.automaticDiscounts)).toBe(150000);
    expect(Number(result.a!.totalDiscounts)).toBe(200000);
    expect(Number(result.a!.netSales)).toBe(300000);
  });

  it("retains inactive owners and groups by ID when names match", async () => {
    await connection.query("UPDATE users SET name='Nama sama',deleted_at='2026-10-05 01:00:00' WHERE id=2");
    await connection.query("UPDATE users SET name='Nama sama' WHERE id=3");
    const result = await report();
    expect(Number(result.summary.totalCashiers)).toBe(2);
    expect(Number(result.a!.inactive)).toBe(1);
    expect(Number(result.b!.inactive)).toBe(0);
  });

  it("applies cashier/location filters to original sales and closure rows", async () => {
    const filtered = await report({ cashierId: 2, locationId: 7 });
    expect(Number(filtered.summary.totalCashiers)).toBe(1);
    expect(Number(filtered.summary.netSales)).toBe(400000);
    expect(filtered.b).toBeUndefined();
    expect(Number((await report({ locationId: 8 })).summary.transactions)).toBe(0);
  });

  it("reports legacy snapshot and orphan/status/date anomalies without silently assigning them", async () => {
    await connection.query("UPDATE order_items SET regular_price=NULL WHERE id=1");
    await connection.query(`INSERT INTO orders VALUES
      (101,NULL,'pos','delivered','2026-10-02 01:00:00','2026-10-02 01:00:00',10000,0,10000,NULL),
      (102,20,'pos','delivered',NULL,'2026-10-02 01:00:00',10000,0,10000,'cash'),
      (103,20,'pos','cancelled','2026-10-02 01:00:00','2026-10-02 01:00:00',10000,0,10000,'cash'),
      (104,20,'online','delivered','2026-10-02 01:00:00','2026-10-02 01:00:00',10000,0,10000,'cash')`);
    const result = await report();
    expect(Number(result.summary.transactions)).toBe(1);
    expect(Number(result.a!.legacyPriceOrders)).toBe(1);
    expect(Number(result.quality.missingSessionOrders)).toBe(1);
    expect(Number(result.quality.missingPaymentDateOrders)).toBe(1);
    expect(Number(result.quality.unexpectedStatusOrders)).toBe(1);
  });

  it("paginates cashier rows in SQL while retaining a summary of every matching cashier", async () => {
    for (let index = 0; index < 27; index++) {
      await connection.execute("INSERT INTO users VALUES (?, ?, NULL)", [100 + index, `Kasir ${index}`]);
      await connection.execute("INSERT INTO pos_sessions (id,cashier_id,location_id,opened_at,closed_at,pos_session_status,cash_difference) VALUES (?,?,7,'2026-10-01 01:00:00','2026-10-02 10:00:00','closed',100)", [100 + index, 100 + index]);
    }
    const first = await report({ page: 1 });
    const second = await report({ page: 2 });
    expect(first.rows.filter(row => row.rowKind === "cashier")).toHaveLength(25);
    expect(second.rows.filter(row => row.rowKind === "cashier")).toHaveLength(4);
    expect(Number(second.summary.totalCashiers)).toBe(29);
    expect(Number(second.summary.netSales)).toBe(Number(first.summary.netSales));
    expect(Number(second.summary.cashDifference)).toBe(5700);
    expect(Number((await report({ page: 99 })).summary.totalCashiers)).toBe(29);
  });

  describe("event revenue on the migrated session relationship", () => {
    beforeAll(async () => {
      await connection.query("ALTER TABLE pos_sessions ADD COLUMN sales_event_id INT NULL");
    });

    async function eventReport(input: Parameters<typeof parseCashierReportFilters>[0] = {}, dimension: "event" | "day" = "event", asOf = new Date("2026-11-02T00:00:00Z")) {
      const parsed = parseCashierReportFilters({ from: "2026-10-01", to: "2026-10-31", ...input }, asOf);
      if (!parsed.success) throw new Error(parsed.error);
      const [result] = await drizzle(connection).execute(buildEventSalesReportQuery(parsed.filters, dimension));
      const rows = result as RowDataPacket[];
      return { summary: rows.find(row => row.rowKind === "summary")!, rows: rows.filter(row => row.rowKind === "detail") };
    }

    beforeEach(async () => {
      await connection.query("UPDATE pos_sessions SET sales_event_id = CASE WHEN id=20 THEN 5 ELSE 6 END");
    });

    it("attributes a refund processed in another event to the original event and original cashier", async () => {
      const result = await eventReport();
      expect(result.rows).toHaveLength(1);
      expect(Number(result.rows[0].groupId)).toBe(5);
      expect(Number(result.rows[0].netSales)).toBe(400000);
      expect(Number(result.rows[0].transferRefunds)).toBe(100000);
      const cashier = await report({ eventId: 5 });
      expect(Number(cashier.a!.netSales)).toBe(400000);
      expect(cashier.b).toBeUndefined();
      expect(Number((await eventReport({ eventId: 6 })).summary.netSales)).toBe(0);
    });

    it("excludes regular sessions, online orders and orders without sessions", async () => {
      await connection.query("UPDATE pos_sessions SET sales_event_id=NULL WHERE id=20");
      expect(Number((await eventReport()).summary.transactions)).toBe(0);
      await connection.query("INSERT INTO orders VALUES (101,NULL,'pos','delivered','2026-10-02 01:00:00','2026-10-02 01:00:00',10000,0,10000,'cash')");
      expect(Number((await eventReport()).summary.transactions)).toBe(0);
    });

    it("keeps multi-item and multi-refund totals independent and computes discounts from snapshots", async () => {
      await connection.query("UPDATE order_items SET regular_price=120000 WHERE id=1");
      await connection.query("UPDATE orders SET discount_amount=5000,total=495000 WHERE id=100");
      await connection.query("INSERT INTO pos_returns VALUES (11,100,NULL,1,'2026-11-01 02:00:00','qris',50000)");
      await connection.query("INSERT INTO pos_return_items VALUES (2,11,1,true)");
      const { summary } = await eventReport();
      expect(Number(summary.transactions)).toBe(1);
      expect(Number(summary.grossSales)).toBe(540000);
      expect(Number(summary.totalDiscounts)).toBe(45000);
      expect(Number(summary.refunds)).toBe(150000);
      expect(Number(summary.netSales)).toBe(345000);
      expect(Number(summary.itemsSold)).toBe(5);
      expect(Number(summary.returnedItems)).toBe(2);
      expect(Number(summary.salesSessionCount)).toBe(1);
    });

    it("uses WIB sale days, includes later refunds and respects the as-of cutoff", async () => {
      const result = await eventReport({}, "day");
      expect(String(result.rows[0].groupId)).toBe("2026-10-01");
      expect(Number(result.rows[0].refunds)).toBe(100000);
      expect(Number((await eventReport({}, "event", new Date("2026-10-31T00:00:00Z"))).summary.refunds)).toBe(0);
      expect(Number((await eventReport({ cashierId: 3 })).summary.transactions)).toBe(0);
      expect(Number((await eventReport({ locationId: 8 })).summary.transactions)).toBe(0);
    });

    it("flags excluded paid-status/date records and preserves legacy completeness signals", async () => {
      await connection.query("UPDATE order_items SET regular_price=NULL WHERE id=1");
      await connection.query("INSERT INTO orders VALUES (101,20,'pos','delivered',NULL,'2026-10-02 01:00:00',10000,0,10000,'cash'),(102,20,'pos','cancelled','2026-10-02 01:00:00','2026-10-02 01:00:00',10000,0,10000,'cash')");
      const parsed = parseCashierReportFilters({ from: "2026-10-01", to: "2026-10-31" }, new Date("2026-11-02T00:00:00Z"));
      if (!parsed.success) throw new Error(parsed.error);
      const [quality] = await drizzle(connection).execute(buildEventReportQualityQuery(parsed.filters));
      expect(Number((quality as RowDataPacket[])[0].excludedOrders)).toBe(2);
      expect(Number((await eventReport()).summary.legacyPriceOrders)).toBe(1);
    });

    it("paginates events in SQL without limiting the summary", async () => {
      for (let index=0; index<27; index++) {
        await connection.query("INSERT INTO pos_sessions (id,cashier_id,location_id,pos_session_status,sales_event_id) VALUES (?,2,7,'open',?)",[100+index,100+index]);
        await connection.query("INSERT INTO orders VALUES (?,?,'pos','delivered','2026-10-02 01:00:00','2026-10-02 01:00:00',10000,0,10000,'cash')",[200+index,100+index]);
      }
      const first=await eventReport();
      const second=await eventReport({ page: 2 });
      expect(first.rows).toHaveLength(25);
      expect(second.rows).toHaveLength(3);
      expect(Number(second.summary.totalGroups)).toBe(28);
      expect(Number(second.summary.netSales)).toBe(Number(first.summary.netSales));
      expect((await eventReport({ page: 999 })).rows).toHaveLength(0);
    });
  });
});
