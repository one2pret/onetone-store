import { describe, expect, it } from 'vitest';
import {
  calculateMembershipOrderReward,
  calculateReturnPointsTarget,
  calculateReturnSpendTarget,
  resolveTierForSpend,
} from '@/lib/membership-rewards';

const tiers = [
  { id: 1, minSpend: 0, pointMultiplier: 1, sortOrder: 1 },
  { id: 2, minSpend: 500_000, pointMultiplier: 2, sortOrder: 2 },
  { id: 3, minSpend: 2_000_000, pointMultiplier: 3, sortOrder: 3 },
];

describe('membership rewards', () => {
  it('earns points with the current tier multiplier and upgrades by total spend', () => {
    expect(calculateMembershipOrderReward({
      subtotal: 120_000,
      currentPoints: 7,
      currentTotalSpend: 450_000,
      currentTierId: 1,
      tiers,
    })).toEqual({
      pointsEarned: 12,
      points: 19,
      totalSpend: 570_000,
      tierId: 2,
    });
  });

  it('uses the existing tier multiplier before evaluating the next upgrade', () => {
    const reward = calculateMembershipOrderReward({
      subtotal: 100_000,
      currentPoints: 20,
      currentTotalSpend: 600_000,
      currentTierId: 2,
      tiers,
    });
    expect(reward.pointsEarned).toBe(20);
    expect(reward.points).toBe(40);
  });

  it('selects the highest eligible tier', () => {
    expect(resolveTierForSpend(tiers, 2_500_000, 1)).toBe(3);
  });

  it('reverses points and credited spend proportionally, capped at a full refund', () => {
    expect(calculateReturnPointsTarget({ pointsEarned: 10, orderTotal: 90_000, cumulativeRefund: 45_000 })).toBe(5);
    expect(calculateReturnSpendTarget({ orderSubtotal: 100_000, orderTotal: 90_000, cumulativeRefund: 45_000 })).toBe(50_000);
    expect(calculateReturnPointsTarget({ pointsEarned: 10, orderTotal: 90_000, cumulativeRefund: 120_000 })).toBe(10);
    expect(calculateReturnSpendTarget({ orderSubtotal: 100_000, orderTotal: 90_000, cumulativeRefund: 120_000 })).toBe(100_000);
  });
});
