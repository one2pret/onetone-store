import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { buildCashierReportQualityQuery, buildCashierReportQuery } from "@/lib/pos-reporting-queries";
import { parseCashierReportFilters } from "@/lib/pos-reporting";

describe("physical POS report column mapping", () => {
  it.each([
    ["sales aggregation", buildCashierReportQuery],
    ["data quality", buildCashierReportQualityQuery],
  ])("uses order_channel in the %s query", (_name, buildQuery) => {
    const parsed = parseCashierReportFilters({ from: "2026-10-01", to: "2026-10-01" }, new Date("2026-10-12T00:00:00Z"));
    if (!parsed.success) throw new Error(parsed.error);
    const query = new MySqlDialect().sqlToQuery(buildQuery(parsed.filters));
    expect(query.sql).toContain("`o`.`order_channel` = 'pos'");
    expect(query.sql).not.toMatch(/\bo\.channel\b|`o`\.`channel`/);
  });
});
