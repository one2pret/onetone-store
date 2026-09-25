"use server";

import { db } from "@/lib/db";
import {
  inventoryBalances,
  inventoryLocations,
  inventoryMovements,
  orderItems,
  orders,
  posReturnItems,
  posReturns,
  posSessions,
  users,
} from "@/lib/db/schema";
import { calculatePosReturn } from "@/lib/pos-return-pricing";
import { requirePosAdmin } from "@/lib/pos-auth";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createReturnSchema = z.object({
  orderId: z.number().int().positive(),
  items: z.array(z.object({
    orderItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    restock: z.boolean(),
  })).min(1, "Pilih minimal satu item"),
  refundMethod: z.enum(["cash", "qris", "transfer"]),
  refundSessionId: z.number().int().positive().nullable().optional(),
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500),
});

function generateReturnNumber() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `RET-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function getPosReturnAdminData() {
  const auth = await requirePosAdmin();
  if (!auth.ok) return null;

  const sales = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    subtotal: orders.subtotal,
    discountAmount: orders.discountAmount,
    total: orders.total,
    paymentMethod: orders.posPaymentMethod,
    customerName: orders.shippingName,
    createdAt: orders.createdAt,
    locationId: posSessions.locationId,
    locationName: inventoryLocations.name,
  }).from(orders)
    .innerJoin(posSessions, eq(orders.posSessionId, posSessions.id))
    .leftJoin(inventoryLocations, eq(posSessions.locationId, inventoryLocations.id))
    .where(and(eq(orders.channel, "pos"), eq(orders.status, "delivered")))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  const orderIds = sales.map(sale => sale.id);
  const items = orderIds.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
    : [];
  const itemIds = items.map(item => item.id);
  const returnedItems = itemIds.length
    ? await db.select().from(posReturnItems).where(inArray(posReturnItems.orderItemId, itemIds))
    : [];
  const history = await db.select({
    id: posReturns.id,
    returnNumber: posReturns.returnNumber,
    orderId: posReturns.orderId,
    orderNumber: orders.orderNumber,
    refundMethod: posReturns.refundMethod,
    refundAmount: posReturns.refundAmount,
    reason: posReturns.reason,
    createdAt: posReturns.createdAt,
    actorName: users.name,
    locationName: inventoryLocations.name,
  }).from(posReturns)
    .innerJoin(orders, eq(posReturns.orderId, orders.id))
    .innerJoin(users, eq(posReturns.actorUserId, users.id))
    .innerJoin(inventoryLocations, eq(posReturns.locationId, inventoryLocations.id))
    .orderBy(desc(posReturns.createdAt))
    .limit(100);

  const activeSessions = await db.select({
    id: posSessions.id,
    locationId: posSessions.locationId,
    locationName: inventoryLocations.name,
    cashierName: users.name,
  }).from(posSessions)
    .innerJoin(users, eq(posSessions.cashierId, users.id))
    .leftJoin(inventoryLocations, eq(posSessions.locationId, inventoryLocations.id))
    .where(eq(posSessions.status, "open"));

  return { sales, items, returnedItems, history, activeSessions };
}

export async function createPosReturn(input: z.input<typeof createReturnSchema>) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return { success: false, error: auth.error };
  const parsed = createReturnSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Retur tidak valid" };
  const data = parsed.data;
  if (new Set(data.items.map(item => item.orderItemId)).size !== data.items.length) {
    return { success: false, error: "Item retur duplikat" };
  }

  try {
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM orders WHERE id = ${data.orderId} FOR UPDATE`);
      const orderRows = await tx.select({
        id: orders.id,
        channel: orders.channel,
        status: orders.status,
        discountAmount: orders.discountAmount,
        locationId: posSessions.locationId,
      }).from(orders)
        .innerJoin(posSessions, eq(orders.posSessionId, posSessions.id))
        .where(eq(orders.id, data.orderId)).limit(1);
      const order = orderRows[0];
      if (!order || order.channel !== "pos" || order.status !== "delivered" || !order.locationId) {
        throw new Error("Transaksi POS tidak ditemukan atau tidak dapat diretur");
      }
      const refundSessionId = data.refundSessionId ?? null;
      if (data.refundMethod === "cash" && !refundSessionId) {
        throw new Error("Refund tunai memerlukan sesi kasir aktif di lokasi penjualan");
      }
      if (refundSessionId) {
        const refundSessions = await tx.select({ id: posSessions.id, locationId: posSessions.locationId, status: posSessions.status })
          .from(posSessions).where(eq(posSessions.id, refundSessionId)).limit(1);
        const refundSession = refundSessions[0];
        if (!refundSession || refundSession.status !== "open" || refundSession.locationId !== order.locationId) {
          throw new Error("Sesi refund harus aktif dan berada di lokasi penjualan yang sama");
        }
      }

      const purchased = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      const purchasedIds = purchased.map(item => item.id);
      const previous = purchasedIds.length
        ? await tx.select().from(posReturnItems).where(inArray(posReturnItems.orderItemId, purchasedIds))
        : [];
      const pricing = calculatePosReturn(
        purchased.map(item => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: Number(item.price),
          netSubtotal: Number(item.subtotal),
        })),
        previous.map(item => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          refundAmount: Number(item.refundAmount),
        })),
        data.items.map(item => ({ orderItemId: item.orderItemId, quantity: item.quantity })),
        Number(order.discountAmount ?? 0),
      );
      if (pricing.refundAmount <= 0) throw new Error("Nilai refund tidak valid");

      const inserted = await tx.insert(posReturns).values({
        returnNumber: generateReturnNumber(),
        orderId: order.id,
        locationId: order.locationId,
        posSessionId: refundSessionId,
        actorUserId: auth.actor.id,
        refundMethod: data.refundMethod,
        refundAmount: String(pricing.refundAmount),
        reason: data.reason,
      }).$returningId();
      const returnId = inserted[0]?.id;
      if (!returnId) throw new Error("Gagal membuat histori retur");

      for (const line of pricing.lines) {
        const purchasedItem = purchased.find(item => item.id === line.orderItemId)!;
        const requested = data.items.find(item => item.orderItemId === line.orderItemId)!;
        await tx.insert(posReturnItems).values({
          returnId,
          orderItemId: purchasedItem.id,
          productId: purchasedItem.productId!,
          variantId: purchasedItem.variantId,
          quantity: line.quantity,
          refundAmount: String(line.refundAmount),
          restocked: requested.restock,
        });

        if (requested.restock) {
          const condition = purchasedItem.variantId
            ? and(eq(inventoryBalances.locationId, order.locationId), eq(inventoryBalances.productId, purchasedItem.productId!), eq(inventoryBalances.variantId, purchasedItem.variantId))
            : and(eq(inventoryBalances.locationId, order.locationId), eq(inventoryBalances.productId, purchasedItem.productId!), isNull(inventoryBalances.variantId));
          const balances = await tx.select().from(inventoryBalances).where(condition).limit(1);
          const balanceAfter = (balances[0]?.quantity ?? 0) + line.quantity;
          if (balances[0]) {
            await tx.update(inventoryBalances).set({ quantity: balanceAfter }).where(eq(inventoryBalances.id, balances[0].id));
          } else {
            await tx.insert(inventoryBalances).values({
              locationId: order.locationId,
              productId: purchasedItem.productId!,
              variantId: purchasedItem.variantId,
              quantity: line.quantity,
            });
          }
          await tx.insert(inventoryMovements).values({
            locationId: order.locationId,
            productId: purchasedItem.productId!,
            variantId: purchasedItem.variantId,
            quantityDelta: line.quantity,
            balanceAfter,
            type: "return",
            referenceType: "pos_return",
            referenceId: returnId,
            actorUserId: auth.actor.id,
            notes: data.reason,
          });
        }
      }
      return { returnId, refundAmount: pricing.refundAmount };
    });

    revalidatePath("/dashboard/pos/returns");
    revalidatePath("/dashboard/pos/sessions");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/pos");
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal memproses retur" };
  }
}
