"use server";

import { asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inventoryLocations, salesEvents, users } from "@/lib/db/schema";
import { requirePosAdmin } from "@/lib/pos-auth";
import { buildEventReportQualityQuery, buildEventSalesReportQuery } from "@/lib/pos-event-reporting";
import { buildCashierReportQuery } from "@/lib/pos-reporting-queries";
import { CASHIER_REPORT_PAGE_SIZE, parseCashierReportFilters, readCashierMetrics, type CashierReportInput } from "@/lib/pos-reporting";

export async function getEventSalesReport(input: CashierReportInput = {}) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return { success: false, error: auth.error } as const;
  const parsed = parseCashierReportFilters(input);
  if (!parsed.success) return parsed;
  const filters = parsed.filters;

  return db.transaction(async tx => {
    const events = await tx.select({ id: salesEvents.id, code: salesEvents.code, name: salesEvents.name, status: salesEvents.status,
      startsAt: salesEvents.startsAt, endsAt: salesEvents.endsAt, venueName: salesEvents.venueName })
      .from(salesEvents).orderBy(asc(salesEvents.name), asc(salesEvents.id));
    const cashiers = await tx.select({ id: users.id, name: users.name }).from(users)
      .where(or(eq(users.role, "admin"), eq(users.role, "cashier"), sql`EXISTS (SELECT 1 FROM pos_sessions s WHERE s.cashier_id = ${users.id})`)).orderBy(asc(users.name));
    const locations = await tx.select({ id: inventoryLocations.id, code: inventoryLocations.code, name: inventoryLocations.name }).from(inventoryLocations)
      .where(or(eq(inventoryLocations.type, "pos"), sql`EXISTS (SELECT 1 FROM pos_sessions s WHERE s.location_id = ${inventoryLocations.id})`)).orderBy(asc(inventoryLocations.name));
    if (filters.eventId && !events.some(event => event.id === filters.eventId)) return { success: false, error: "Event pada filter tidak ditemukan" } as const;
    if (filters.cashierId && !cashiers.some(cashier => cashier.id === filters.cashierId)) return { success: false, error: "Kasir pada filter tidak ditemukan" } as const;
    if (filters.locationId && !locations.some(location => location.id === filters.locationId)) return { success: false, error: "Lokasi pada filter tidak ditemukan" } as const;

    const [raw] = await tx.execute(buildEventSalesReportQuery(filters));
    const rows = raw as unknown as Record<string, unknown>[];
    const summary = rows.find(row => row.rowKind === "summary") ?? {};
    const eventMap = new Map(events.map(event => [event.id, event]));
    const [qualityRows] = await tx.execute(buildEventReportQualityQuery(filters));
    const quality = (qualityRows as unknown as { excludedOrders: number }[])[0];
    let days: { date: string; metrics: ReturnType<typeof readCashierMetrics> }[] = [];
    let cashierRows: { id: number; name: string; metrics: ReturnType<typeof readCashierMetrics> }[] = [];
    let totalCashiers = 0;
    if (filters.eventId) {
      const [dayResult] = await tx.execute(buildEventSalesReportQuery(filters, "day"));
      days = (dayResult as unknown as Record<string, unknown>[]).filter(row => row.rowKind === "detail")
        .map(row => ({ date: String(row.groupId), metrics: readCashierMetrics(row) }));
      const [cashierResult] = await tx.execute(buildCashierReportQuery({ ...filters, page: 1 }));
      const cashierData = cashierResult as unknown as Record<string, unknown>[];
      totalCashiers = Number(cashierData.find(row => row.rowKind === "summary")?.totalCashiers ?? 0);
      cashierRows = cashierData.filter(row => row.rowKind === "cashier").map(row => ({ id: Number(row.cashierId), name: String(row.cashierName), metrics: readCashierMetrics(row) }));
    }
    return { success: true, data: {
      filters: { from: filters.from, to: filters.to, cashierId: filters.cashierId, locationId: filters.locationId, eventId: filters.eventId, page: filters.page },
      asOf: filters.asOf.toISOString(), pageSize: CASHIER_REPORT_PAGE_SIZE,
      summary: readCashierMetrics(summary), totalEvents: Number(summary.totalGroups ?? 0),
      rows: rows.filter(row => row.rowKind === "detail").map(row => ({ id: Number(row.groupId), event: eventMap.get(Number(row.groupId)), metrics: readCashierMetrics(row) })),
      events, cashiers, locations, selectedEvent: filters.eventId ? eventMap.get(filters.eventId) : undefined,
      days, cashierRows, totalCashiers, excludedOrders: Number(quality?.excludedOrders ?? 0),
    } } as const;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
