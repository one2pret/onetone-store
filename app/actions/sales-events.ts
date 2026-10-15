"use server";

import { and, asc, desc, eq, lte, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { inventoryLocations, posSessions, salesEvents } from "@/lib/db/schema";
import { requirePosAdmin, requirePosOperator } from "@/lib/pos-auth";
import { salesEventCanTransition, salesEventSchema, type SalesEventInput } from "@/lib/sales-events";

class EventValidationError extends Error {}

function revalidateEvents() {
  revalidatePath("/dashboard/reports/events");
  revalidatePath("/dashboard/pos/sessions");
  revalidatePath("/pos");
}

function saveError(error: unknown) {
  if (error instanceof EventValidationError) return error.message;
  const dbError = error as { code?: string; cause?: { code?: string } };
  if (dbError.code === "ER_DUP_ENTRY" || dbError.cause?.code === "ER_DUP_ENTRY") return "Kode event sudah digunakan";
  return "Event belum dapat disimpan. Coba lagi.";
}

export async function getActiveSalesEvents() {
  const auth = await requirePosOperator();
  if (!auth.ok) return [];
  const now = new Date();
  return db.select({ id: salesEvents.id, code: salesEvents.code, name: salesEvents.name,
    venueName: salesEvents.venueName, inventoryLocationId: salesEvents.inventoryLocationId })
    .from(salesEvents).where(and(eq(salesEvents.status, "active"), lte(salesEvents.startsAt, now), gt(salesEvents.endsAt, now)))
    .orderBy(asc(salesEvents.name));
}

export async function getSalesEventsAdminData(page = 1) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return null;
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return null;
  const pageSize = 25;
  const sessionCount = sql<number>`(SELECT COUNT(*) FROM pos_sessions s WHERE s.sales_event_id = ${salesEvents.id})`.mapWith(Number);
  const openSessions = sql<number>`(SELECT COUNT(*) FROM pos_sessions s WHERE s.sales_event_id = ${salesEvents.id} AND s.pos_session_status = 'open')`.mapWith(Number);
  const [events, countRows, locations] = await Promise.all([
    db.select({ event: salesEvents, locationName: inventoryLocations.name, sessionCount, openSessions })
      .from(salesEvents).leftJoin(inventoryLocations, eq(salesEvents.inventoryLocationId, inventoryLocations.id))
      .orderBy(desc(salesEvents.createdAt), desc(salesEvents.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)`.mapWith(Number) }).from(salesEvents),
    db.select({ id: inventoryLocations.id, name: inventoryLocations.name, code: inventoryLocations.code, isActive: inventoryLocations.isActive })
      .from(inventoryLocations).where(eq(inventoryLocations.type, "pos")).orderBy(asc(inventoryLocations.name)),
  ]);
  return { events, locations, total: countRows[0]?.count ?? 0, page, pageSize };
}

export async function createSalesEvent(input: SalesEventInput) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return { success: false, error: auth.error } as const;
  const parsed = salesEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Event tidak valid" } as const;
  const data = parsed.data;
  if (data.status !== "draft" && data.status !== "active") return { success: false, error: "Event baru harus Draft atau Aktif" } as const;

  try {
    const eventId = await db.transaction(async tx => {
      if (data.inventoryLocationId) {
        const locations = await tx.select({ id: inventoryLocations.id }).from(inventoryLocations)
          .where(and(eq(inventoryLocations.id, data.inventoryLocationId), eq(inventoryLocations.type, "pos"), eq(inventoryLocations.isActive, true))).limit(1);
        if (!locations[0]) throw new EventValidationError("Lokasi default harus lokasi POS aktif");
      }
      const [inserted] = await tx.insert(salesEvents).values({ ...data, venueName: data.venueName || null,
        notes: data.notes || null, createdByUserId: auth.actor.id });
      return Number(inserted.insertId);
    });
    revalidateEvents();
    return { success: true, eventId } as const;
  } catch (error) {
    return { success: false, error: saveError(error) } as const;
  }
}

export async function updateSalesEvent(eventId: number, input: SalesEventInput) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return { success: false, error: auth.error } as const;
  if (!Number.isSafeInteger(eventId) || eventId < 1) return { success: false, error: "Event tidak valid" } as const;
  const parsed = salesEventSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Event tidak valid" } as const;
  const data = parsed.data;

  try {
    await db.transaction(async tx => {
      const [event] = await tx.select().from(salesEvents).where(eq(salesEvents.id, eventId)).limit(1).for("update");
      if (!event) throw new EventValidationError("Event tidak ditemukan");
      if (!salesEventCanTransition(event.status, data.status)) throw new EventValidationError("Perubahan status event tidak diizinkan");
      if (event.status === "closed" || event.status === "cancelled") throw new EventValidationError("Event selesai/dibatalkan tidak dapat diubah");
      const [sessions] = await tx.select({ count: sql<number>`COUNT(*)`.mapWith(Number),
        open: sql<number>`COALESCE(SUM(CASE WHEN ${posSessions.status} = 'open' THEN 1 ELSE 0 END), 0)`.mapWith(Number) })
        .from(posSessions).where(eq(posSessions.salesEventId, eventId));
      const used = (sessions?.count ?? 0) > 0;
      const detailsChanged = event.code !== data.code || event.name !== data.name
        || event.startsAt.getTime() !== data.startsAt.getTime() || event.endsAt.getTime() !== data.endsAt.getTime()
        || event.venueName !== (data.venueName || null) || event.inventoryLocationId !== data.inventoryLocationId || event.notes !== (data.notes || null);
      if (used && detailsChanged) throw new EventValidationError("Detail event terkunci karena sudah dipakai sesi POS");
      if ((data.status === "closed" || data.status === "cancelled") && (sessions?.open ?? 0) > 0) {
        throw new EventValidationError("Tutup semua sesi POS event sebelum menyelesaikan atau membatalkan event");
      }
      if (!used && data.inventoryLocationId) {
        const locations = await tx.select({ id: inventoryLocations.id }).from(inventoryLocations)
          .where(and(eq(inventoryLocations.id, data.inventoryLocationId), eq(inventoryLocations.type, "pos"), eq(inventoryLocations.isActive, true))).limit(1);
        if (!locations[0]) throw new EventValidationError("Lokasi default harus lokasi POS aktif");
      }
      await tx.update(salesEvents).set({ ...data, venueName: data.venueName || null, notes: data.notes || null })
        .where(eq(salesEvents.id, eventId));
    });
    revalidateEvents();
    return { success: true, eventId } as const;
  } catch (error) {
    return { success: false, error: saveError(error) } as const;
  }
}
