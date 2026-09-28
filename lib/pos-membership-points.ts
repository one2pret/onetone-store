import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { memberships, memberTiers, orders, pointsLedger } from '@/lib/db/schema';
import { calculateMembershipOrderReward } from '@/lib/membership-rewards';

export async function awardPosOrderPoints(orderId: number, userId: number) {
  try {
    return await db.transaction(async tx => {
      const orderRows = await tx.select({
        id: orders.id,
        userId: orders.userId,
        channel: orders.channel,
        status: orders.status,
        subtotal: orders.subtotal,
      }).from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)
        .for('update');
      const order = orderRows[0];
      if (!order || order.userId !== userId || order.channel !== 'pos' || order.status !== 'delivered') {
        return { awarded: false, pointsEarned: 0 } as const;
      }

      const memberRows = await tx.select().from(memberships)
        .where(eq(memberships.userId, userId))
        .limit(1)
        .for('update');
      const membership = memberRows[0];
      if (!membership) return { awarded: false, pointsEarned: 0 } as const;

      const existing = await tx.select({ id: pointsLedger.id, delta: pointsLedger.delta })
        .from(pointsLedger)
        .where(and(
          eq(pointsLedger.membershipId, membership.id),
          eq(pointsLedger.orderId, order.id),
          eq(pointsLedger.reason, 'order_earn'),
        ))
        .limit(1);
      if (existing[0]) {
        return { awarded: false, pointsEarned: existing[0].delta } as const;
      }

      const tiers = await tx.select().from(memberTiers).orderBy(memberTiers.sortOrder);
      const reward = calculateMembershipOrderReward({
        subtotal: Number(order.subtotal),
        currentPoints: membership.points ?? 0,
        currentTotalSpend: membership.totalSpend ?? 0,
        currentTierId: membership.tierId,
        tiers,
      });

      await tx.update(memberships).set({
        points: reward.points,
        totalSpend: reward.totalSpend,
        tierId: reward.tierId,
      }).where(eq(memberships.id, membership.id));
      await tx.update(orders).set({ pointsEarned: reward.pointsEarned }).where(eq(orders.id, order.id));
      await tx.insert(pointsLedger).values({
        membershipId: membership.id,
        orderId: order.id,
        delta: reward.pointsEarned,
        reason: 'order_earn',
      });

      return { awarded: true, pointsEarned: reward.pointsEarned } as const;
    });
  } catch (error) {
    const dbError = error as { code?: string; errno?: number };
    if (dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062) {
      return { awarded: false, pointsEarned: 0 } as const;
    }
    throw error;
  }
}
