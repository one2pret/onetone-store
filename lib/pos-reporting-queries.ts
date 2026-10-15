import { sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { orders } from "@/lib/db/schema";
import { CASHIER_METRICS, CASHIER_REPORT_PAGE_SIZE, type CashierReportFilters } from "@/lib/pos-reporting";

const orderAlias = alias(orders, "o");

function sessionFilter(filters: CashierReportFilters) {
  return sql`1 = 1
    ${filters.cashierId ? sql`AND s.cashier_id = ${filters.cashierId}` : sql``}
    ${filters.locationId ? sql`AND s.location_id = ${filters.locationId}` : sql``}
    ${filters.eventId ? sql`AND s.sales_event_id = ${filters.eventId}` : sql``}`;
}

export function buildPosSalesLedger(filters: CashierReportFilters, eventOnly = false) {
  const end = new Date(Math.min(filters.end.getTime(), filters.asOf.getTime()));
  // Each ledger is aggregated before joining: two items and two refunds must not multiply the sale.
  return sql`WITH filtered_sessions AS (
    SELECT s.* FROM pos_sessions s WHERE ${sessionFilter(filters)} ${eventOnly ? sql`AND s.sales_event_id IS NOT NULL` : sql``}
  ), filtered_orders AS (
    SELECT o.* FROM orders o INNER JOIN filtered_sessions s ON s.id = o.pos_session_id
    WHERE ${orderAlias.channel} = 'pos' AND o.status = 'delivered'
      AND o.paid_at >= ${filters.start} AND o.paid_at < ${end}
  ), item_totals AS (
    SELECT i.order_id, SUM(i.quantity) AS units,
      SUM((COALESCE(i.regular_price, i.price) - i.price) * i.quantity) AS automatic_discount,
      MAX(CASE WHEN i.regular_price IS NULL THEN 1 ELSE 0 END) AS legacy_price
    FROM order_items i INNER JOIN filtered_orders o ON o.id = i.order_id
    GROUP BY i.order_id
  ), refund_totals AS (
    SELECT r.order_id, SUM(r.refund_amount) AS amount,
      SUM(CASE WHEN r.refund_method = 'cash' THEN r.refund_amount ELSE 0 END) AS cash_amount,
      SUM(CASE WHEN r.refund_method = 'qris' THEN r.refund_amount ELSE 0 END) AS qris_amount,
      SUM(CASE WHEN r.refund_method = 'transfer' THEN r.refund_amount ELSE 0 END) AS transfer_amount
    FROM pos_returns r INNER JOIN filtered_orders o ON o.id = r.order_id
    WHERE r.created_at <= ${filters.asOf}
    GROUP BY r.order_id
  ), returned_units AS (
    SELECT r.order_id, SUM(ri.quantity) AS units
    FROM pos_return_items ri INNER JOIN pos_returns r ON r.id = ri.return_id
      INNER JOIN filtered_orders o ON o.id = r.order_id
    WHERE r.created_at <= ${filters.asOf}
    GROUP BY r.order_id
  )`;
}

export function buildCashierReportQuery(filters: CashierReportFilters) {
  const end = new Date(Math.min(filters.end.getTime(), filters.asOf.getTime()));
  const summaryMetrics = sql.join(CASHIER_METRICS.map(key =>
    sql`COALESCE(SUM(${sql.identifier(key)}), 0) AS ${sql.identifier(key)}`), sql`, `);
  const rowMetrics = sql.join(CASHIER_METRICS.map(key => sql.identifier(key)), sql`, `);
  return sql`${buildPosSalesLedger(filters)}, sales_totals AS (
    SELECT s.cashier_id, COUNT(*) AS transactions, SUM(o.subtotal) AS subtotal,
      SUM(COALESCE(i.automatic_discount, 0)) AS automaticDiscounts,
      SUM(COALESCE(o.discount_amount, 0)) AS additionalDiscounts,
      SUM(o.total) AS salesBeforeRefunds, SUM(COALESCE(r.amount, 0)) AS refunds,
      SUM(COALESCE(i.units, 0)) AS itemsSold, SUM(COALESCE(ru.units, 0)) AS returnedItems,
      COUNT(DISTINCT o.pos_session_id) AS salesSessionCount,
      SUM(COALESCE(i.legacy_price, 0)) AS legacyPriceOrders,
      SUM(CASE WHEN i.order_id IS NULL THEN 1 ELSE 0 END) AS missingItemOrders,
      SUM(CASE WHEN o.pos_payment_method = 'cash' THEN o.total ELSE 0 END) AS cashSales,
      SUM(CASE WHEN o.pos_payment_method = 'qris' THEN o.total ELSE 0 END) AS qrisSales,
      SUM(CASE WHEN o.pos_payment_method = 'transfer' THEN o.total ELSE 0 END) AS transferSales,
      SUM(CASE WHEN o.pos_payment_method IS NULL OR o.pos_payment_method NOT IN ('cash', 'qris', 'transfer') THEN o.total ELSE 0 END) AS unknownPaymentSales,
      SUM(COALESCE(r.cash_amount, 0)) AS cashRefunds, SUM(COALESCE(r.qris_amount, 0)) AS qrisRefunds,
      SUM(COALESCE(r.transfer_amount, 0)) AS transferRefunds
    FROM filtered_orders o INNER JOIN filtered_sessions s ON s.id = o.pos_session_id
      LEFT JOIN item_totals i ON i.order_id = o.id LEFT JOIN refund_totals r ON r.order_id = o.id
      LEFT JOIN returned_units ru ON ru.order_id = o.id
    GROUP BY s.cashier_id
  ), closing_totals AS (
    SELECT s.cashier_id, COUNT(*) AS closedSessionCount,
      SUM(COALESCE(s.cash_difference, 0)) AS cashDifference,
      SUM(CASE WHEN s.cash_difference IS NULL THEN 1 ELSE 0 END) AS cashDifferenceMissing
    FROM filtered_sessions s WHERE s.pos_session_status = 'closed'
      AND s.closed_at >= ${filters.start} AND s.closed_at < ${end}
    GROUP BY s.cashier_id
  ), cashier_ids AS (
    SELECT cashier_id FROM sales_totals UNION SELECT cashier_id FROM closing_totals
  ), metrics AS (
    SELECT ids.cashier_id AS cashierId, COALESCE(u.name, CONCAT('User #', ids.cashier_id)) AS cashierName,
      CASE WHEN u.id IS NULL OR u.deleted_at IS NOT NULL THEN 1 ELSE 0 END AS inactive,
      COALESCE(a.transactions, 0) AS transactions, COALESCE(a.subtotal, 0) AS subtotal,
      COALESCE(a.subtotal, 0) + COALESCE(a.automaticDiscounts, 0) AS grossSales,
      COALESCE(a.automaticDiscounts, 0) AS automaticDiscounts,
      COALESCE(a.additionalDiscounts, 0) AS additionalDiscounts,
      COALESCE(a.automaticDiscounts, 0) + COALESCE(a.additionalDiscounts, 0) AS totalDiscounts,
      COALESCE(a.salesBeforeRefunds, 0) AS salesBeforeRefunds, COALESCE(a.refunds, 0) AS refunds,
      COALESCE(a.salesBeforeRefunds, 0) - COALESCE(a.refunds, 0) AS netSales,
      COALESCE(a.itemsSold, 0) AS itemsSold, COALESCE(a.returnedItems, 0) AS returnedItems,
      COALESCE(a.itemsSold, 0) - COALESCE(a.returnedItems, 0) AS netItems,
      COALESCE(a.salesSessionCount, 0) AS salesSessionCount,
      COALESCE(c.closedSessionCount, 0) AS closedSessionCount, COALESCE(c.cashDifference, 0) AS cashDifference,
      COALESCE(c.cashDifferenceMissing, 0) AS cashDifferenceMissing,
      COALESCE(a.legacyPriceOrders, 0) AS legacyPriceOrders, COALESCE(a.missingItemOrders, 0) AS missingItemOrders,
      COALESCE(a.cashSales, 0) AS cashSales, COALESCE(a.qrisSales, 0) AS qrisSales,
      COALESCE(a.transferSales, 0) AS transferSales, COALESCE(a.unknownPaymentSales, 0) AS unknownPaymentSales,
      COALESCE(a.cashRefunds, 0) AS cashRefunds, COALESCE(a.qrisRefunds, 0) AS qrisRefunds,
      COALESCE(a.transferRefunds, 0) AS transferRefunds
    FROM cashier_ids ids LEFT JOIN sales_totals a ON a.cashier_id = ids.cashier_id
      LEFT JOIN closing_totals c ON c.cashier_id = ids.cashier_id LEFT JOIN users u ON u.id = ids.cashier_id
  ), paged_cashiers AS (
    SELECT * FROM metrics ORDER BY netSales DESC, cashierId ASC
    LIMIT ${CASHIER_REPORT_PAGE_SIZE} OFFSET ${(filters.page - 1) * CASHIER_REPORT_PAGE_SIZE}
  )
  SELECT 'summary' AS rowKind, NULL AS cashierId, NULL AS cashierName, 0 AS inactive,
    COUNT(*) AS totalCashiers, ${summaryMetrics} FROM metrics
  UNION ALL
  SELECT 'cashier' AS rowKind, cashierId, cashierName, inactive, 0 AS totalCashiers,
    ${rowMetrics} FROM paged_cashiers
  ORDER BY rowKind DESC, netSales DESC, cashierId ASC`;
}

export function buildCashierReportQualityQuery(filters: CashierReportFilters) {
  const end = new Date(Math.min(filters.end.getTime(), filters.asOf.getTime()));
  return sql`SELECT
    COALESCE(SUM(CASE WHEN s.id IS NULL THEN 1 ELSE 0 END), 0) AS missingSessionOrders,
    COALESCE(SUM(CASE WHEN s.id IS NOT NULL AND s.location_id IS NULL THEN 1 ELSE 0 END), 0) AS missingLocationOrders,
    COALESCE(SUM(CASE WHEN o.paid_at IS NULL THEN 1 ELSE 0 END), 0) AS missingPaymentDateOrders,
    COALESCE(SUM(CASE WHEN o.paid_at IS NOT NULL AND (o.status IS NULL OR o.status <> 'delivered') THEN 1 ELSE 0 END), 0) AS unexpectedStatusOrders
    FROM orders o LEFT JOIN pos_sessions s ON s.id = o.pos_session_id
    WHERE ${orderAlias.channel} = 'pos' AND ${sessionFilter(filters)}
      AND ((o.paid_at >= ${filters.start} AND o.paid_at < ${end})
        OR (o.paid_at IS NULL AND o.created_at >= ${filters.start} AND o.created_at < ${end}))`;
}
