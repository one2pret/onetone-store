import { sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { orders } from "@/lib/db/schema";
import { buildPosSalesLedger } from "@/lib/pos-reporting-queries";
import { CASHIER_REPORT_PAGE_SIZE, type CashierReportFilters } from "@/lib/pos-reporting";

export const EVENT_METRICS = ["transactions", "grossSales", "automaticDiscounts", "additionalDiscounts", "totalDiscounts", "salesBeforeRefunds", "refunds", "netSales", "itemsSold", "returnedItems", "netItems", "salesSessionCount", "legacyPriceOrders", "missingItemOrders", "cashSales", "qrisSales", "transferSales", "unknownPaymentSales", "cashRefunds", "qrisRefunds", "transferRefunds"] as const;

export function buildEventSalesReportQuery(filters: CashierReportFilters, dimension: "event" | "day" = "event") {
  // UTC connection/session: explicit +07:00 conversion does not depend on MySQL timezone tables.
  const group = dimension === "event" ? sql`s.sales_event_id` : sql`DATE_FORMAT(DATE_ADD(o.paid_at, INTERVAL 7 HOUR), '%Y-%m-%d')`;
  const values = sql.join(EVENT_METRICS.map(key => sql.identifier(key)), sql`, `);
  const totals = sql.join(EVENT_METRICS.map(key => sql`COALESCE(SUM(${sql.identifier(key)}), 0) AS ${sql.identifier(key)}`), sql`, `);
  const pagination = dimension === "event" ? sql`LIMIT ${CASHIER_REPORT_PAGE_SIZE} OFFSET ${(filters.page - 1) * CASHIER_REPORT_PAGE_SIZE}` : sql``;
  return sql`${buildPosSalesLedger(filters, true)}, aggregates AS (
    SELECT ${group} AS groupId, COUNT(*) AS transactions,
      SUM(o.subtotal + COALESCE(i.automatic_discount, 0)) AS grossSales,
      SUM(COALESCE(i.automatic_discount, 0)) AS automaticDiscounts,
      SUM(COALESCE(o.discount_amount, 0)) AS additionalDiscounts,
      SUM(COALESCE(i.automatic_discount, 0) + COALESCE(o.discount_amount, 0)) AS totalDiscounts,
      SUM(o.total) AS salesBeforeRefunds, SUM(COALESCE(r.amount, 0)) AS refunds,
      SUM(o.total - COALESCE(r.amount, 0)) AS netSales,
      SUM(COALESCE(i.units, 0)) AS itemsSold, SUM(COALESCE(ru.units, 0)) AS returnedItems,
      SUM(COALESCE(i.units, 0) - COALESCE(ru.units, 0)) AS netItems,
      COUNT(DISTINCT o.pos_session_id) AS salesSessionCount,
      SUM(COALESCE(i.legacy_price, 0)) AS legacyPriceOrders,
      SUM(CASE WHEN i.order_id IS NULL THEN 1 ELSE 0 END) AS missingItemOrders,
      SUM(CASE WHEN o.pos_payment_method = 'cash' THEN o.total ELSE 0 END) AS cashSales,
      SUM(CASE WHEN o.pos_payment_method = 'qris' THEN o.total ELSE 0 END) AS qrisSales,
      SUM(CASE WHEN o.pos_payment_method = 'transfer' THEN o.total ELSE 0 END) AS transferSales,
      SUM(CASE WHEN o.pos_payment_method IS NULL OR o.pos_payment_method NOT IN ('cash','qris','transfer') THEN o.total ELSE 0 END) AS unknownPaymentSales,
      SUM(COALESCE(r.cash_amount, 0)) AS cashRefunds, SUM(COALESCE(r.qris_amount, 0)) AS qrisRefunds,
      SUM(COALESCE(r.transfer_amount, 0)) AS transferRefunds
    FROM filtered_orders o INNER JOIN filtered_sessions s ON s.id = o.pos_session_id
      LEFT JOIN item_totals i ON i.order_id = o.id
      LEFT JOIN refund_totals r ON r.order_id = o.id
      LEFT JOIN returned_units ru ON ru.order_id = o.id
    GROUP BY ${group}
  ), page_rows AS (
    SELECT * FROM aggregates ORDER BY ${dimension === "event" ? sql`netSales DESC, groupId ASC` : sql`groupId ASC`} ${pagination}
  )
  SELECT 'summary' AS rowKind, NULL AS groupId, COUNT(*) AS totalGroups, ${totals} FROM aggregates
  UNION ALL SELECT 'detail' AS rowKind, groupId, 0 AS totalGroups, ${values} FROM page_rows
  ORDER BY rowKind DESC, ${dimension === "event" ? sql`netSales DESC, groupId ASC` : sql`groupId ASC`}`;
}

export function buildEventReportQualityQuery(filters: CashierReportFilters) {
  const end = new Date(Math.min(filters.end.getTime(), filters.asOf.getTime()));
  const order = alias(orders, "o");
  return sql`SELECT COUNT(*) AS excludedOrders FROM orders o
    INNER JOIN pos_sessions s ON s.id = o.pos_session_id
    WHERE ${order.channel} = 'pos' AND s.sales_event_id IS NOT NULL
      ${filters.eventId ? sql`AND s.sales_event_id = ${filters.eventId}` : sql``}
      ${filters.cashierId ? sql`AND s.cashier_id = ${filters.cashierId}` : sql``}
      ${filters.locationId ? sql`AND s.location_id = ${filters.locationId}` : sql``}
      AND ((o.paid_at IS NULL AND o.created_at >= ${filters.start} AND o.created_at < ${end})
        OR (o.paid_at >= ${filters.start} AND o.paid_at < ${end} AND (o.status IS NULL OR o.status <> 'delivered')))`;
}
