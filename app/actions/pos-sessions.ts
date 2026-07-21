"use server";

// app/actions/pos-sessions.ts
// POS Session lifecycle: buka kasir (openingCash) → transaksi → tutup kasir (Z-report)
// Filosofi Odoo POS: satu session = satu shift kasir, semua transaksi di-track ke session.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { posSessions, orders, users, orderItems } from "@/lib/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const openSessionSchema = z.object({
  openingCash: z.number().min(0, "Modal awal tidak boleh negatif"),
  notes: z.string().max(500).optional(),
  cashierId: z.number().int().positive().optional(),
});

const closeSessionSchema = z.object({
  sessionId: z.number().int().positive(),
  closingCash: z.number().min(0, "Uang tunai fisik tidak boleh negatif"),
  notes: z.string().max(500).optional(),
});

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireCashier() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "admin") {
    return { ok: false as const, error: "Hanya admin yang dapat mengakses POS" };
  }
  return { ok: true as const, userId: Number(session.user.id) };
}

// ─── Get active session ───────────────────────────────────────────────────────

export async function getActiveSession() {
  const auth = await requireCashier();
  if (!auth.ok) return null;

  // Cek sesi milik sendiri dulu
  const ownRows = await db
    .select()
    .from(posSessions)
    .where(and(eq(posSessions.cashierId, auth.userId), eq(posSessions.status, "open")))
    .limit(1);

  if (ownRows[0]) return ownRows[0];

  // Proxy-open: jika admin membuka sesi untuk kasir lain (single-store, 1 sesi aktif)
  const anyRows = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.status, "open"))
    .orderBy(desc(posSessions.openedAt))
    .limit(1);

  return anyRows[0] ?? null;
}

// ─── Open session ─────────────────────────────────────────────────────────────

export async function getCashierUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.role, 'admin'), sql`${users.deletedAt} IS NULL`))
    .orderBy(users.name);
}

export async function openSession(input: { openingCash: number; notes?: string; cashierId?: number }) {
  const authResult = await requireCashier();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const parsed = openSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  // Kasir yang akan dibuka sesinya: dipilih dari dropdown atau fallback ke auth user
  const targetCashierId = parsed.data.cashierId ?? authResult.userId;

  // Tidak boleh ada session open untuk kasir yang dipilih
  const existing = await db
    .select({ id: posSessions.id })
    .from(posSessions)
    .where(and(eq(posSessions.cashierId, targetCashierId), eq(posSessions.status, "open")))
    .limit(1);

  if (existing.length > 0) {
    return {
      success: false,
      error: "Kasir ini masih punya sesi aktif. Tutup dulu sebelum buka yang baru.",
    };
  }

  const [result] = await db.insert(posSessions).values({
    cashierId: targetCashierId,
    openingCash: String(parsed.data.openingCash),
    status: "open",
    notes: parsed.data.notes || null,
  });

  revalidatePath("/pos");
  return { success: true, sessionId: Number(result.insertId) };
}

// ─── Session summary (Z-report data) ──────────────────────────────────────────

export async function getSessionSummary(sessionId: number) {
  const auth = await requireCashier();
  if (!auth.ok) return null;

  const sessionRows = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, sessionId))
    .limit(1);
  if (sessionRows.length === 0) return null;
  const session = sessionRows[0];

  // Agregasi per payment method
  const rows = await db
    .select({
      paymentMethod: orders.posPaymentMethod,
      total: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(orders)
    .where(and(eq(orders.posSessionId, sessionId), eq(orders.channel, "pos")))
    .groupBy(orders.posPaymentMethod);

  const breakdown = {
    cash: { total: 0, count: 0 },
    qris: { total: 0, count: 0 },
    transfer: { total: 0, count: 0 },
  };

  let totalSales = 0;
  let totalTransactions = 0;

  for (const row of rows) {
    const method = row.paymentMethod as keyof typeof breakdown | null;
    const amount = Number(row.total);
    const count = Number(row.count);
    if (method && method in breakdown) {
      breakdown[method] = { total: amount, count };
    }
    totalSales += amount;
    totalTransactions += count;
  }

  const openingCash = Number(session.openingCash);
  const expectedCash = openingCash + breakdown.cash.total;

  return {
    session,
    breakdown,
    totalSales,
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
  const auth = await requireCashier();
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

  if (session.cashierId !== auth.userId) {
    return { success: false, error: "Sesi kasir bukan milikmu" };
  }
  if (session.status === "closed") {
    return { success: false, error: "Sesi kasir sudah ditutup" };
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

  return {
    success: true,
    expectedCash: summary.expectedCash,
    cashDifference,
  };
}

// ─── Admin: list all sessions (dengan agregasi cepat) ─────────────────────────

export async function getAllPosSessions() {
  const auth = await requireCashier();
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
    })
    .from(posSessions)
    .leftJoin(users, eq(posSessions.cashierId, users.id))
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
  const auth = await requireCashier();
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
  const auth = await requireCashier();
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
