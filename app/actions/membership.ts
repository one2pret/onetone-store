'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { memberships, memberTiers, pointsLedger, vouchers } from '@/lib/db/schema';
import { eq, and, isNull, or, lte, gte, desc } from 'drizzle-orm';

export async function getMyMembership() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = Number(session.user.id);

  const row = await db
    .select()
    .from(memberships)
    .innerJoin(memberTiers, eq(memberships.tierId, memberTiers.id))
    .where(eq(memberships.userId, userId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!row) return null;

  const allTiers = await db
    .select()
    .from(memberTiers)
    .orderBy(memberTiers.sortOrder);

  const currentIdx = allTiers.findIndex((t) => t.id === row.memberships.tierId);
  const nextTier = allTiers[currentIdx + 1] ?? null;
  const totalSpend = row.memberships.totalSpend ?? 0;

  return {
    ...row.memberships,
    tier: row.member_tiers,
    nextTier,
    progressPct: nextTier
      ? Math.min(100, Math.round((totalSpend / (nextTier.minSpend ?? 1)) * 100))
      : 100,
    allTiers,
  };
}

export async function getMyPoints() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = Number(session.user.id);

  const membership = await db
    .select({ id: memberships.id, points: memberships.points })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!membership) return null;

  const ledger = await db
    .select()
    .from(pointsLedger)
    .where(eq(pointsLedger.membershipId, membership.id))
    .orderBy(desc(pointsLedger.createdAt))
    .limit(30);

  return { balance: membership.points ?? 0, ledger };
}

export async function getMyVouchers() {
  const session = await auth();
  if (!session?.user) return [];

  const userId = Number(session.user.id);

  const membership = await db
    .select({ tierId: memberships.tierId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1)
    .then((r) => r[0] ?? null);

  const now = new Date();

  const rows = await db
    .select()
    .from(vouchers)
    .where(
      and(
        eq(vouchers.isActive, true),
        or(isNull(vouchers.startsAt), lte(vouchers.startsAt, now)),
        or(isNull(vouchers.endsAt), gte(vouchers.endsAt, now))
      )
    );

  return rows.filter((v) => {
    if (v.quota !== null && (v.usedCount ?? 0) >= v.quota) return false;
    if (!v.tierId) return true;
    if (!membership) return false;
    return v.tierId <= membership.tierId;
  });
}
