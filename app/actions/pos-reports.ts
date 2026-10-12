"use server";

import { asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventoryLocations, users } from "@/lib/db/schema";
import { requirePosAdmin } from "@/lib/pos-auth";
import { buildCashierReportQuery, buildCashierReportQualityQuery } from "@/lib/pos-reporting-queries";
import { CASHIER_REPORT_PAGE_SIZE, parseCashierReportFilters, readCashierMetrics, type CashierReportInput, type CashierReportRow } from "@/lib/pos-reporting";

export async function getCashierSalesReport(input: CashierReportInput = {}) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return { success: false, error: auth.error } as const;

  const parsed = parseCashierReportFilters(input);
  if (!parsed.success) return parsed;
  const filters = parsed.filters;

  return db.transaction(async tx => {
    const cashiers = await tx.select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
      .from(users).where(or(eq(users.role, "admin"), eq(users.role, "cashier"),
        sql`EXISTS (SELECT 1 FROM pos_sessions s WHERE s.cashier_id = ${users.id})`)).orderBy(asc(users.name), asc(users.id));
    const locations = await tx.select({ id: inventoryLocations.id, name: inventoryLocations.name, code: inventoryLocations.code, isActive: inventoryLocations.isActive })
      .from(inventoryLocations).where(or(eq(inventoryLocations.type, "pos"),
        sql`EXISTS (SELECT 1 FROM pos_sessions s WHERE s.location_id = ${inventoryLocations.id})`)).orderBy(asc(inventoryLocations.name));

    if (filters.cashierId && !cashiers.some(row => row.id === filters.cashierId)) {
      return { success: false, error: "Kasir pada filter tidak ditemukan" } as const;
    }
    if (filters.locationId && !locations.some(row => row.id === filters.locationId)) {
      return { success: false, error: "Lokasi pada filter tidak ditemukan" } as const;
    }

    const [rawRows] = await tx.execute(buildCashierReportQuery(filters));
    const [qualityRows] = await tx.execute(buildCashierReportQualityQuery(filters));
    const rows = rawRows as unknown as Record<string, unknown>[];
    const summaryRow = rows.find(row => row.rowKind === "summary") ?? {};
    const quality = (qualityRows as unknown as Record<string, unknown>[])[0] ?? {};
    const cashiersRows: CashierReportRow[] = rows.filter(row => row.rowKind === "cashier").map(row => ({
      ...readCashierMetrics(row), cashierId: Number(row.cashierId), cashierName: String(row.cashierName), inactive: Boolean(Number(row.inactive)),
    }));

    return {
      success: true,
      data: {
        filters: { from: filters.from, to: filters.to, cashierId: filters.cashierId, locationId: filters.locationId, page: filters.page },
        asOf: filters.asOf.toISOString(), pageSize: CASHIER_REPORT_PAGE_SIZE, totalCashiers: Number(summaryRow.totalCashiers ?? 0),
        summary: readCashierMetrics(summaryRow), rows: cashiersRows,
        cashiers: cashiers.map(row => ({ id: row.id, name: row.name, inactive: row.deletedAt !== null })), locations,
        quality: {
          missingSessionOrders: Number(quality.missingSessionOrders ?? 0), missingLocationOrders: Number(quality.missingLocationOrders ?? 0),
          missingPaymentDateOrders: Number(quality.missingPaymentDateOrders ?? 0), unexpectedStatusOrders: Number(quality.unexpectedStatusOrders ?? 0),
        },
      },
    } as const;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
