import { and, eq, gte, sql } from 'drizzle-orm';
import type { db } from '@/lib/db';
import { memberships, memberTiers, pointsLedger } from '@/lib/db/schema';

/**
 * The EXACT transaction type used by the shared checkout kernel.
 * All reads and writes here share the same order/cart/inventory transaction.
 * Never create another transaction or call the payment provider here.
 */
export type CheckoutTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LockedMembership = {
  id: number;
  points: number;
  freeShippingThreshold: number | null;
};

/** Must run after the account row lock, before price calculation and order insert. */
export async function loadLockedCheckoutMembership(
  tx: CheckoutTransaction,
  userId: number,
): Promise<LockedMembership | null> {
  const [member] = await tx.select({
    id: memberships.id,
    tierId: memberships.tierId,
    points: memberships.points,
  }).from(memberships).where(eq(memberships.userId, userId))
    .for('update').limit(1);
  if (!member) return null;

  const [tier] = await tx.select({
    freeShippingThreshold: memberTiers.freeShippingThreshold,
  }).from(memberTiers).where(eq(memberTiers.id, member.tierId)).limit(1);
  if (!tier) throw new Error('Membership tier missing; checkout must rollback');

  return {
    id: member.id,
    points: member.points ?? 0,
    freeShippingThreshold: tier.freeShippingThreshold,
  };
}

/**
 * Debit a server-validated, exact number of points and create its audit entry
 * together with the order and stock changes. Both operations rollback if ANY
 * later checkout step fails. Unique (membershipId, orderId, reason) in schema
 * is an additional guard against duplicate ledger entries.
 */
export async function debitCheckoutMembershipPoints(
  tx: CheckoutTransaction,
  args: { membershipId: number; orderId: number; points: number },
): Promise<void> {
  if (!Number.isSafeInteger(args.membershipId) || args.membershipId <= 0 ||
      !Number.isSafeInteger(args.orderId) || args.orderId <= 0 ||
      !Number.isSafeInteger(args.points) || args.points < 0) {
    throw new Error('Invalid checkout membership debit arguments');
  }
  if (args.points === 0) return;

  const [updated] = await tx.update(memberships)
    .set({ points: sql`${memberships.points} - ${args.points}` })
    .where(and(eq(memberships.id, args.membershipId),
      gte(memberships.points, args.points)));
  if (updated.affectedRows !== 1) {
    throw new Error('Membership points changed during checkout');
  }

  await tx.insert(pointsLedger).values({
    membershipId: args.membershipId,
    orderId: args.orderId,
    delta: -args.points,
    reason: 'order_redeem',
  });
}
