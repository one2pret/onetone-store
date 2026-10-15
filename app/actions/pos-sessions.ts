"use server";

// app/actions/pos-sessions.ts
// POS Session lifecycle: buka kasir (openingCash) → transaksi → tutup kasir (Z-report)
// Filosofi Odoo POS: satu session = satu shift kasir, semua transaksi di-track ke session.

import { db } from "@/lib/db";
import { inventoryLocations, posSessions, orders, users, orderItems, posReturns, salesEvents } from "@/lib/db/schema";
import { canAccessPosSession, requirePosAdmin, requirePosOperator } from "@/lib/pos-auth";
import { salesEventIsSelectable } from "@/lib/sales-events";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const openSessionSchema = z.object({
  locationId: z.number().int().positive("Pilih lokasi POS"),
  salesEventId: z.number().int().positive().nullable().optional(),
  openingCash: z.number().finite().min(0, "Modal awal tidak boleh negatif").max(9_999_999_999.99),
  notes: z.string().max(500).optional(),
});

const closeSessionSchema = z.object({
  sessionId: z.number().int().positive(),
  closingCash: z.number().min(0, "Uang tunai fisik tidak boleh negatif"),
  notes: z.string().max(500).optional(),
});

// ─── Auth helper ──────────────────────────────────────────────────────────────

// ─── Get active session ───────────────────────────────────────────────────────

async function getSessionEvent(salesEventId: number | null | undefined) {
  if (!salesEventId) return null;
  const events = await db.select({ id: salesEvents.id, code: salesEvents.code, name: salesEvents.name, status: salesEvents.status })
    .from(salesEvents).where(eq(salesEvents.id, salesEventId)).limit(1);
  return events[0] ?? null;
}

export async function getActiveSession() {
  const auth = await requirePosOperator();
  if (!auth.ok) return null;

  const rows = await db
    .select()
    .from(posSessions)
    .where(and(eq(posSessions.cashierId, auth.actor.id), eq(posSessions.status, "open")))
    .limit(1);

  const session = rows[0];
  return session ? { ...session, salesEvent: await getSessionEvent(session.salesEventId) } : null;
}

// ─── Open session ─────────────────────────────────────────────────────────────

export async function getCashierUsers() {
  const auth = await requirePosAdmin();
  if (!auth.ok) return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(
      sql`${users.role} IN ('admin', 'cashier')`,
      sql`${users.deletedAt} IS NULL`
    ))
    .orderBy(users.name);
}

class SessionValidationError extends Error {}

export async function openSession(input: { locationId: number; salesEventId?: number | null; openingCash: number; notes?: string }) {
  const authResult = await requirePosOperator();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const parsed = openSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  try {
    const sessionId = await db.transaction(async tx => {
      // Serialize openings for one owner; an event lock also coordinates admin changes with new sessions.
      const [operator] = await tx.select({ id: users.id, name: users.name }).from(users)
        .where(and(eq(users.id, authResult.actor.id), isNull(users.deletedAt), sql`${users.role} IN ('admin', 'cashier')`))
        .limit(1).for("update");
      if (!operator) throw new SessionValidationError("Akses POS ditolak");
      if (parsed.data.salesEventId) {
        const [event] = await tx.select().from(salesEvents).where(eq(salesEvents.id, parsed.data.salesEventId)).limit(1).for("update");
        if (!event || !salesEventIsSelectable(event)) throw new SessionValidationError("Event tidak aktif atau berada di luar periode. Pilih event lain atau penjualan reguler.");
      }
      const locations = await tx.select({ id: inventoryLocations.id }).from(inventoryLocations)
        .where(and(eq(inventoryLocations.id, parsed.data.locationId), eq(inventoryLocations.type, "pos"), eq(inventoryLocations.isActive, true))).limit(1);
      if (!locations[0]) throw new SessionValidationError("Lokasi POS tidak aktif atau tidak ditemukan");
      const existing = await tx.select({ id: posSessions.id }).from(posSessions)
        .where(and(eq(posSessions.cashierId, operator.id), eq(posSessions.status, "open"))).limit(1);
      if (existing.length) throw new SessionValidationError("Masih ada sesi kasir aktif. Tutup dulu sebelum buka yang baru.");
      const [result] = await tx.insert(posSessions).values({
        cashierId: operator.id, locationId: parsed.data.locationId, salesEventId: parsed.data.salesEventId ?? null,
        openingCash: String(parsed.data.openingCash), status: "open", assignedCashierName: operator.name, notes: parsed.data.notes || null,
      });
      return Number(result.insertId);
    });
    revalidatePath("/pos");
    revalidatePath("/dashboard/pos/sessions");
    revalidatePath("/dashboard/reports/events");
    return { success: true, sessionId };
  } catch (error) {
    return { success: false, error: error instanceof SessionValidationError ? error.message : "Sesi kasir belum dapat dibuka. Coba lagi." };
  }
}

// ─── Session summary (Z-report data) ──────────────────────────────────────────

export async function getSessionSummary(sessionId: number) {
  const auth = await requirePosOperator();
  if (!auth.ok) return null;

  const sessionRows = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, sessionId))
    .limit(1);
  if (sessionRows.length === 0) return null;
  const session = sessionRows[0];
  if (!canAccessPosSession(auth.actor, session.cashierId)) return null;

  // Agregasi per payment method
  const rows = await db
    .select({
      paymentMethod: orders.posPaymentMethod,
      total: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      discount: sql<string>`COALESCE(SUM(${orders.discountAmount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(eq(orders.posSessionId, sessionId), eq(orders.channel, "pos")))
    .groupBy(orders.posPaymentMethod);

  const refundRows = await db.select({
    paymentMethod: posReturns.refundMethod,
    total: sql<string>`COALESCE(SUM(${posReturns.refundAmount}), 0)`,
  }).from(posReturns)
    .where(eq(posReturns.posSessionId, sessionId))
    .groupBy(posReturns.refundMethod);

  const breakdown = {
    cash: { total: 0, count: 0 },
    qris: { total: 0, count: 0 },
    transfer: { total: 0, count: 0 },
  };

  let totalSales = 0;
  let totalDiscounts = 0;
  let totalRefunds = 0;
  let totalTransactions = 0;

  for (const row of rows) {
    const method = row.paymentMethod as keyof typeof breakdown | null;
    const amount = Number(row.total);
    const count = Number(row.count);
    if (method && method in breakdown) {
      breakdown[method] = { total: amount, count };
    }
    totalSales += amount;
    totalDiscounts += Number(row.discount);
    totalTransactions += count;
  }

  for (const row of refundRows) {
    const method = row.paymentMethod as keyof typeof breakdown;
    const amount = Number(row.total);
    if (method in breakdown) breakdown[method].total -= amount;
    totalRefunds += amount;
    totalSales -= amount;
  }

  const openingCash = Number(session.openingCash);
  const expectedCash = openingCash + breakdown.cash.total;

  return {
    session,
    salesEvent: await getSessionEvent(session.salesEventId),
    breakdown,
    totalSales,
    totalDiscounts,
    totalRefunds,
    totalTransactions,
    openingCash,
    expectedCash,
  };
}

// ─── Close session ────────────────────────────────────────────────────────────

export async function closeSession(input: {
  sessionId: number;
  closingCash: number;
  notes?: string;
}) {
  const auth = await requirePosOperator();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = closeSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const sessionRows = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, parsed.data.sessionId))
    .limit(1);

  if (sessionRows.length === 0) {
    return { success: false, error: "Sesi kasir tidak ditemukan" };
  }
  const session = sessionRows[0];

  if (session.status === "closed") {
    return { success: false, error: "Sesi kasir sudah ditutup" };
  }
  if (!canAccessPosSession(auth.actor, session.cashierId)) {
    return { success: false, error: "Sesi kasir bukan milikmu" };
  }

  const summary = await getSessionSummary(parsed.data.sessionId);
  if (!summary) {
    return { success: false, error: "Gagal menghitung summary sesi" };
  }

  const cashDifference = parsed.data.closingCash - summary.expectedCash;

  await db
    .update(posSessions)
    .set({
      closedAt: new Date(),
      closingCash: String(parsed.data.closingCash),
      expectedCash: String(summary.expectedCash),
      cashDifference: String(cashDifference),
      status: "closed",
      notes: parsed.data.notes || session.notes,
    })
    .where(eq(posSessions.id, parsed.data.sessionId));

  revalidatePath("/pos");
  revalidatePath("/dashboard/pos/sessions");
  revalidatePath("/dashboard/reports/events");

  return {
    success: true,
    expectedCash: summary.expectedCash,
    cashDifference,
  };
}

// ─── Admin: list all sessions (dengan agregasi cepat) ─────────────────────────

export async function getAllPosSessions() {
  const auth = await requirePosAdmin();
  if (!auth.ok) return [];

  const sessions = await db
    .select({
      id: posSessions.id,
      cashierId: posSessions.cashierId,
      cashierName: users.name,
      openedAt: posSessions.openedAt,
      closedAt: posSessions.closedAt,
      openingCash: posSessions.openingCash,
      closingCash: posSessions.closingCash,
      expectedCash: posSessions.expectedCash,
      cashDifference: posSessions.cashDifference,
      status: posSessions.status,
      notes: posSessions.notes,
      salesEventId: posSessions.salesEventId,
      salesEventName: salesEvents.name,
    })
    .from(posSessions)
    .leftJoin(users, eq(posSessions.cashierId, users.id))
    .leftJoin(salesEvents, eq(posSessions.salesEventId, salesEvents.id))
    .orderBy(desc(posSessions.openedAt));

  if (sessions.length === 0) return [];

  // Agregasi total penjualan & jumlah transaksi per sesi (single query)
  const sessionIds = sessions.map((s) => s.id);
  const stats = await db
    .select({
      sessionId: orders.posSessionId,
      totalSales: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      transactions: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.channel, "pos"),
        sql`${orders.posSessionId} IN (${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)})`
      )
    )
    .groupBy(orders.posSessionId);

  const statMap = new Map(stats.map((s) => [s.sessionId, s]));

  return sessions.map((s) => {
    const stat = statMap.get(s.id);
    return {
      ...s,
      totalSales: stat ? Number(stat.totalSales) : 0,
      transactions: stat ? Number(stat.transactions) : 0,
    };
  });
}

// ─── Admin: detail session (Z-report + transaksi) ─────────────────────────────

export async function getPosSessionDetail(sessionId: number) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return null;

  const summary = await getSessionSummary(sessionId);
  if (!summary) return null;

  // Ambil cashier name
  const cashierRows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, summary.session.cashierId))
    .limit(1);

  // Ambil daftar transaksi
  const txs = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      discountAmount: orders.discountAmount,
      total: orders.total,
      posPaymentMethod: orders.posPaymentMethod,
      shippingName: orders.shippingName, // customer name (opsional)
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.posSessionId, sessionId), eq(orders.channel, "pos")))
    .orderBy(desc(orders.createdAt));

  // Ambil item count per order
  const orderIds = txs.map((t) => t.id);
  let itemsPerOrder = new Map<number, number>();
  if (orderIds.length > 0) {
    const itemCounts = await db
      .select({
        orderId: orderItems.orderId,
        count: sql<number>`SUM(${orderItems.quantity})`,
      })
      .from(orderItems)
      .where(
        sql`${orderItems.orderId} IN (${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)})`
      )
      .groupBy(orderItems.orderId);
    itemsPerOrder = new Map(itemCounts.map((c) => [c.orderId, Number(c.count)]));
  }

  return {
    ...summary,
    cashier: cashierRows[0] ?? null,
    transactions: txs.map((t) => ({
      ...t,
      itemCount: itemsPerOrder.get(t.id) ?? 0,
    })),
  };
}

// ─── Admin: penjualan POS hari ini ────────────────────────────────────────────

export async function getTodayPosSales() {
  const auth = await requirePosAdmin();
  if (!auth.ok) return { totalSales: 0, transactions: 0 };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      totalSales: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      transactions: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.channel, "pos"),
        gte(orders.createdAt, startOfDay)
      )
    );

  return {
    totalSales: Number(rows[0]?.totalSales ?? 0),
    transactions: Number(rows[0]?.transactions ?? 0),
  };
}
