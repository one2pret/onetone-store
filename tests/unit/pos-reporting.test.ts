import { describe, expect, it } from "vitest";
import { parseCashierReportFilters, readCashierMetrics } from "@/lib/pos-reporting";

const now = new Date("2026-10-12T03:00:00Z");

describe("POS report filters", () => {
  it("defaults to 30 Jakarta calendar days and captures the refund cutoff", () => {
    const result = parseCashierReportFilters({}, now);
    expect(result).toMatchObject({ success: true, filters: { from: "2026-09-13", to: "2026-10-12", page: 1, asOf: now } });
  });

  it("uses exclusive UTC boundaries for an inclusive WIB date range", () => {
    const result = parseCashierReportFilters({ from: "2026-10-01", to: "2026-10-01", cashierId: "2", locationId: "7" }, now);
    expect(result).toMatchObject({ success: true, filters: {
      start: new Date("2026-09-30T17:00:00Z"), end: new Date("2026-10-01T17:00:00Z"), cashierId: 2, locationId: 7,
    } });
  });

  it.each(["2026-02-30", "2026-13-01", "2026-00-01", "01/10/2026", "2026-10-01' OR 1=1"])('rejects invalid date %s', from => {
    expect(parseCashierReportFilters({ from }, now).success).toBe(false);
  });

  it("rejects reversed and oversized date ranges", () => {
    expect(parseCashierReportFilters({ from: "2026-10-10", to: "2026-10-01" }, now).success).toBe(false);
    expect(parseCashierReportFilters({ from: "2024-01-01", to: "2026-10-01" }, now).success).toBe(false);
  });

  it.each(["-2", "2.1", "abc", "1 OR 1=1", "2147483648"])('rejects invalid filter ID %s', cashierId => {
    expect(parseCashierReportFilters({ cashierId }, now).success).toBe(false);
  });

  it("accepts an empty filter without treating it as zero", () => {
    expect(parseCashierReportFilters({ cashierId: "", locationId: "", page: "" }, now)).toMatchObject({ success: true, filters: { page: 1, cashierId: undefined, locationId: undefined } });
  });

  it.each(["0", "-1", "1.5", "10001"])('rejects invalid page %s', page => {
    expect(parseCashierReportFilters({ page }, now).success).toBe(false);
  });
});

describe("POS report presentation metrics", () => {
  it("converts MySQL decimal strings and computes weighted AOV from sale totals", () => {
    const metrics = readCashierMetrics({ transactions: "3", salesBeforeRefunds: "600000.00", refunds: "100000.00", netSales: "500000.00" });
    expect(metrics).toMatchObject({ transactions: 3, refunds: 100000, netSales: 500000, averageTransaction: 200000 });
  });

  it("does not divide by zero for a closing-only cashier", () => {
    expect(readCashierMetrics({ closedSessionCount: "1", cashDifference: "-5000.00" })).toMatchObject({ averageTransaction: 0, cashDifference: -5000 });
  });
});
