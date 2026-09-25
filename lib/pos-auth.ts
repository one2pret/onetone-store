import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type PosRole = "admin" | "cashier";

export type PosActor = {
  id: number;
  name: string;
  role: PosRole;
};

type PosAuthResult =
  | { ok: true; actor: PosActor }
  | { ok: false; error: string };

/** Resolve the current POS operator from the database instead of a stale JWT. */
export async function requirePosOperator(): Promise<PosAuthResult> {
  const session = await auth();
  const userId = Number(session?.user?.id);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return { ok: false, error: "Silakan login untuk mengakses POS" };
  }

  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  const user = rows[0];
  if (!user || (user.role !== "admin" && user.role !== "cashier")) {
    return { ok: false, error: "Akses POS ditolak" };
  }

  return {
    ok: true,
    actor: { id: user.id, name: user.name, role: user.role },
  };
}

export async function requirePosAdmin(): Promise<PosAuthResult> {
  const result = await requirePosOperator();
  if (!result.ok) return result;
  if (result.actor.role !== "admin") {
    return { ok: false, error: "Hanya admin yang dapat mengakses laporan POS" };
  }
  return result;
}

export function canAccessPosSession(actor: PosActor, cashierId: number): boolean {
  return actor.role === "admin" || actor.id === cashierId;
}
