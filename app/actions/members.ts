// app/actions/members.ts
'use server';

import { db } from '@/lib/db';
import { users, memberships, memberTiers, orders, posCustomerLeads, inventoryLocations } from '@/lib/db/schema';
import { eq, desc, count, and, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { isInternalCustomerEmail } from '@/lib/registration-utils';

async function isAdmin() {
  const session = await auth();
  return session?.user?.role === 'admin';
}

export async function getMembers(tierFilter?: number) {
  if (!(await isAdmin())) return [];
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      birthdate: users.birthdate,
      createdAt: users.createdAt,
      points: memberships.points,
      totalSpend: memberships.totalSpend,
      joinedAt: memberships.joinedAt,
      tierName: memberTiers.name,
      tierId: memberTiers.id,
    })
    .from(users)
    .leftJoin(memberships, eq(users.id, memberships.userId))
    .leftJoin(memberTiers, eq(memberships.tierId, memberTiers.id))
    .where(
      and(
        eq(users.role, 'customer'),
        tierFilter ? eq(memberTiers.id, tierFilter) : undefined,
      )
    )
    .orderBy(desc(users.createdAt));

  return rows.map((row) => ({
    ...row,
    email: isInternalCustomerEmail(row.email) ? null : row.email,
  }));
}

export async function getMember(userId: number) {
  if (!(await isAdmin())) return null;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      address: users.address,
      birthdate: users.birthdate,
      createdAt: users.createdAt,
      points: memberships.points,
      totalSpend: memberships.totalSpend,
      joinedAt: memberships.joinedAt,
      tierName: memberTiers.name,
      tierId: memberTiers.id,
      tierDiscountPct: memberTiers.discountPct,
    })
    .from(users)
    .leftJoin(memberships, eq(users.id, memberships.userId))
    .leftJoin(memberTiers, eq(memberships.tierId, memberTiers.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!rows[0]) return null;

  const orderRows = await db
    .select({
      total: count(),
      totalValue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
    })
    .from(orders)
    .where(eq(orders.userId, userId));

  return {
    ...rows[0],
    email: isInternalCustomerEmail(rows[0].email) ? null : rows[0].email,
    orderCount: orderRows[0].total,
    orderValue: orderRows[0].totalValue,
  };
}

export async function getMemberTiers() {
  if (!(await isAdmin())) return [];
  return db.select().from(memberTiers).orderBy(memberTiers.sortOrder);
}

export async function getPosCustomerLeads() {
  if (!(await isAdmin())) return [];
  return db
    .select({
      id: posCustomerLeads.id,
      name: posCustomerLeads.name,
      phone: posCustomerLeads.phoneNormalized,
      email: posCustomerLeads.email,
      status: posCustomerLeads.status,
      consentAt: posCustomerLeads.consentAt,
      marketingConsentAt: posCustomerLeads.marketingConsentAt,
      createdAt: posCustomerLeads.createdAt,
      createdByName: users.name,
      locationName: inventoryLocations.name,
      claimedUserId: posCustomerLeads.claimedUserId,
    })
    .from(posCustomerLeads)
    .leftJoin(users, eq(posCustomerLeads.createdByUserId, users.id))
    .leftJoin(inventoryLocations, eq(posCustomerLeads.locationId, inventoryLocations.id))
    .orderBy(desc(posCustomerLeads.createdAt))
    .limit(100);
}

export async function getMemberOrders(userId: number) {
  if (!(await isAdmin())) return [];
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(10);
}
