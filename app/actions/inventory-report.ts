"use server";

import { db } from "@/lib/db";
import {
  inventoryBalances, inventoryLocations, inventoryMovements, inventoryReceipts, inventoryTransfers, orderItems, orders,
  posReturnItems, posReturns, posSessions, products, productVariants, users,
} from "@/lib/db/schema";
import { requirePosAdmin } from "@/lib/pos-auth";
import { and, asc, count, desc, eq, gte, inArray, like, lt, or, sql } from "drizzle-orm";

export type InventoryReportFilters = {
  from?: string;
  to?: string;
  locationId?: number;
  search?: string;
  type?: string;
  movementPage?: number;
  stockPage?: number;
};

const movementTypes = ["opening_balance", "receipt", "online_sale", "pos_sale", "return", "transfer_in", "transfer_out", "adjustment"] as const;
const dateKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const pageNumber = (value?: number) => Number.isSafeInteger(value) && value! > 0 ? Math.min(value!, 10000) : 1;

export async function getInventoryReport(input: InventoryReportFilters = {}) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return null;

  const today = new Date();
  const fromDefault = new Date(today.getTime() - 29 * 86_400_000);
  const from = input.from && datePattern.test(input.from) ? input.from : dateKey(fromDefault);
  const to = input.to && datePattern.test(input.to) ? input.to : dateKey(today);
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return null;
  const locationId = Number.isSafeInteger(input.locationId) && input.locationId! > 0 ? input.locationId! : undefined;
  const search = input.search?.trim().slice(0, 100) ?? "";
  const type = movementTypes.find(value => value === input.type) ?? "";
  const movementPage = pageNumber(input.movementPage);
  const stockPage = pageNumber(input.stockPage);
  const pageSize = 50;

  const locations = await db.select({ id: inventoryLocations.id, name: inventoryLocations.name, code: inventoryLocations.code, type: inventoryLocations.type, isOnlineDefault: inventoryLocations.isOnlineDefault })
    .from(inventoryLocations).orderBy(asc(inventoryLocations.name));
  const onlineLocationId = locations.find(row => row.isOnlineDefault)?.id ?? 0;
  const effectiveLocation = sql<number>`case when ${orders.channel} = 'pos' then ${posSessions.locationId} else ${onlineLocationId} end`;
  // Product base rows coexist with variant rows after the legacy stock migration.
  // Count only the sellable level to avoid doubling the stock of variant products.
  const sellableBalance = sql`(${inventoryBalances.variantId} is not null or not exists
    (select 1 from product_variants pv where pv.product_id = ${inventoryBalances.productId}))`;

  const stockFilter = and(
    sellableBalance,
    locationId ? eq(inventoryBalances.locationId, locationId) : undefined,
    search ? or(like(products.name, `%${search}%`), like(productVariants.sku, `%${search}%`), like(productVariants.color, `%${search}%`)) : undefined,
  );
  const movementFilter = and(
    gte(inventoryMovements.createdAt, start), lt(inventoryMovements.createdAt, end),
    locationId ? eq(inventoryMovements.locationId, locationId) : undefined,
    type ? eq(inventoryMovements.type, type) : undefined,
    search ? or(like(products.name, `%${search}%`), like(productVariants.sku, `%${search}%`), like(productVariants.color, `%${search}%`)) : undefined,
  );
  const movementSummaryFilter = and(
    gte(inventoryMovements.createdAt, start), lt(inventoryMovements.createdAt, end),
    locationId ? eq(inventoryMovements.locationId, locationId) : undefined,
  );
  const saleFilter = and(
    gte(orders.paidAt, start), lt(orders.paidAt, end),
    inArray(orders.status, ["packing", "shipping", "delivered"]),
    locationId ? eq(effectiveLocation, locationId) : undefined,
  );

  const [stockByLocation, stockCountRows, stockRows, movementByType, receiptOrigins, movementCountRows, movementRows, salesRows, soldUnitsRows, soldItems, refundRows, returnedItems, transferFlows] = await Promise.all([
    db.select({ locationId: inventoryBalances.locationId, quantity: sql<number>`coalesce(sum(${inventoryBalances.quantity}), 0)`.mapWith(Number), reserved: sql<number>`coalesce(sum(${inventoryBalances.reserved}), 0)`.mapWith(Number), lowStock: sql<number>`sum(case when ${products.isActive} = true and (${inventoryBalances.variantId} is null or ${productVariants.isActive} = true) and ${inventoryBalances.quantity} - ${inventoryBalances.reserved} between 1 and 5 then 1 else 0 end)`.mapWith(Number), outOfStock: sql<number>`sum(case when ${products.isActive} = true and (${inventoryBalances.variantId} is null or ${productVariants.isActive} = true) and ${inventoryBalances.quantity} - ${inventoryBalances.reserved} <= 0 then 1 else 0 end)`.mapWith(Number) })
      .from(inventoryBalances).innerJoin(products, eq(inventoryBalances.productId, products.id)).leftJoin(productVariants, eq(inventoryBalances.variantId, productVariants.id))
      .where(sellableBalance).groupBy(inventoryBalances.locationId),
    db.select({ total: count() }).from(inventoryBalances).innerJoin(products, eq(inventoryBalances.productId, products.id)).leftJoin(productVariants, eq(inventoryBalances.variantId, productVariants.id)).where(stockFilter),
    db.select({ locationId: inventoryBalances.locationId, productId: inventoryBalances.productId, productName: products.name, variantId: inventoryBalances.variantId, sku: productVariants.sku, size: productVariants.size, color: productVariants.color, quantity: inventoryBalances.quantity, reserved: inventoryBalances.reserved })
      .from(inventoryBalances).innerJoin(products, eq(inventoryBalances.productId, products.id)).leftJoin(productVariants, eq(inventoryBalances.variantId, productVariants.id))
      .where(stockFilter).orderBy(asc(products.name), asc(inventoryBalances.locationId), asc(inventoryBalances.variantId)).limit(pageSize).offset((stockPage - 1) * pageSize),
    db.select({ type: inventoryMovements.type, units: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`.mapWith(Number), records: count() })
      .from(inventoryMovements).innerJoin(products, eq(inventoryMovements.productId, products.id)).leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
      .where(movementSummaryFilter).groupBy(inventoryMovements.type),
    db.select({ sourceType: inventoryReceipts.sourceType, units: sql<number>`coalesce(sum(${inventoryMovements.quantityDelta}), 0)`.mapWith(Number) })
      .from(inventoryMovements).leftJoin(inventoryReceipts, and(eq(inventoryMovements.referenceType, "inventory_receipt"), eq(inventoryMovements.referenceId, inventoryReceipts.id)))
      .where(and(movementSummaryFilter, eq(inventoryMovements.type, "receipt"))).groupBy(inventoryReceipts.sourceType),
    db.select({ total: count() }).from(inventoryMovements).innerJoin(products, eq(inventoryMovements.productId, products.id)).leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id)).where(movementFilter),
    db.select({ id: inventoryMovements.id, createdAt: inventoryMovements.createdAt, locationId: inventoryMovements.locationId, productId: inventoryMovements.productId, productName: products.name, variantId: inventoryMovements.variantId, sku: productVariants.sku, size: productVariants.size, color: productVariants.color, type: inventoryMovements.type, quantityDelta: inventoryMovements.quantityDelta, balanceAfter: inventoryMovements.balanceAfter, referenceType: inventoryMovements.referenceType, referenceId: inventoryMovements.referenceId, receiptSourceType: inventoryReceipts.sourceType, actorName: users.name, notes: inventoryMovements.notes })
      .from(inventoryMovements).innerJoin(products, eq(inventoryMovements.productId, products.id)).leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id)).leftJoin(users, eq(inventoryMovements.actorUserId, users.id))
      .leftJoin(inventoryReceipts, and(eq(inventoryMovements.referenceType, "inventory_receipt"), eq(inventoryMovements.referenceId, inventoryReceipts.id)))
      .where(movementFilter).orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id)).limit(pageSize).offset((movementPage - 1) * pageSize),
    db.select({ locationId: effectiveLocation, channel: orders.channel, orders: count(), revenue: sql<number>`coalesce(sum(greatest(0, ${orders.total} - coalesce(${orders.shippingCost}, 0))), 0)`.mapWith(Number) })
      .from(orders).leftJoin(posSessions, eq(orders.posSessionId, posSessions.id)).where(saleFilter).groupBy(effectiveLocation, orders.channel),
    db.select({ locationId: effectiveLocation, units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.mapWith(Number) })
      .from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).leftJoin(posSessions, eq(orders.posSessionId, posSessions.id))
      .where(saleFilter).groupBy(effectiveLocation),
    db.select({ locationId: effectiveLocation, productId: orderItems.productId, productName: orderItems.productName, variantId: orderItems.variantId, variantLabel: orderItems.variantLabel, units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.mapWith(Number) })
      .from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).leftJoin(posSessions, eq(orders.posSessionId, posSessions.id))
      .where(saleFilter).groupBy(effectiveLocation, orderItems.productId, orderItems.productName, orderItems.variantId, orderItems.variantLabel)
      .orderBy(desc(sql`sum(${orderItems.quantity})`)).limit(20),
    db.select({ locationId: posReturns.locationId, amount: sql<number>`coalesce(sum(${posReturns.refundAmount}), 0)`.mapWith(Number), returns: count() })
      .from(posReturns).where(and(gte(posReturns.createdAt, start), lt(posReturns.createdAt, end), locationId ? eq(posReturns.locationId, locationId) : undefined))
      .groupBy(posReturns.locationId),
    db.select({ locationId: posReturns.locationId, units: sql<number>`coalesce(sum(${posReturnItems.quantity}), 0)`.mapWith(Number) })
      .from(posReturnItems).innerJoin(posReturns, eq(posReturnItems.returnId, posReturns.id))
      .where(and(gte(posReturns.createdAt, start), lt(posReturns.createdAt, end), locationId ? eq(posReturns.locationId, locationId) : undefined))
      .groupBy(posReturns.locationId),
    db.select({ fromLocationId: inventoryTransfers.fromLocationId, toLocationId: inventoryTransfers.toLocationId, units: sql<number>`coalesce(sum(${inventoryTransfers.quantity}), 0)`.mapWith(Number), transfers: count() })
      .from(inventoryTransfers)
      .where(and(gte(inventoryTransfers.createdAt, start), lt(inventoryTransfers.createdAt, end), locationId ? or(eq(inventoryTransfers.fromLocationId, locationId), eq(inventoryTransfers.toLocationId, locationId)) : undefined))
      .groupBy(inventoryTransfers.fromLocationId, inventoryTransfers.toLocationId)
      .orderBy(desc(sql`sum(${inventoryTransfers.quantity})`)).limit(20),
  ]);

  return {
    filters: { from, to, locationId: locationId ?? 0, search, type, movementPage, stockPage },
    locations, stockByLocation, stockRows, stockTotal: Number(stockCountRows[0]?.total ?? 0),
    movementByType, receiptOrigins, movementRows, movementTotal: Number(movementCountRows[0]?.total ?? 0),
    salesRows, soldUnitsRows, soldItems, refundRows, returnedItems, transferFlows, pageSize,
  };
}
