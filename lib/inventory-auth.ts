import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userInventoryLocations, users } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type InventoryActor = { id: number; name: string; role: "admin" | "inventory_staff" };

type InventoryAccessResult =
  | { ok: true; actor: InventoryActor; locationIds: number[] | null }
  | { ok: false; error: string };

/** Admin mendapat seluruh lokasi; staf hanya assignment aktif dari database. */
export async function requireInventoryAccess(locationId?: number): Promise<InventoryAccessResult> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return { ok: false, error: "Silakan login untuk mengakses inventori" };

  const rows = await db.select({ id: users.id, name: users.name, role: users.role })
    .from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
  const user = rows[0];
  if (!user || (user.role !== "admin" && user.role !== "inventory_staff")) {
    return { ok: false, error: "Akses inventori ditolak" };
  }
  const actor: InventoryActor = { id: user.id, name: user.name, role: user.role };
  if (user.role === "admin") return { ok: true, actor, locationIds: null };

  const assignments = await db.select({ locationId: userInventoryLocations.locationId })
    .from(userInventoryLocations).where(eq(userInventoryLocations.userId, user.id));
  const locationIds = assignments.map(item => item.locationId);
  if (locationId && !locationIds.includes(locationId)) {
    return { ok: false, error: "Anda tidak memiliki akses ke lokasi inventori ini" };
  }
  return { ok: true, actor, locationIds };
}
