import { calculatePointsEarned } from '@/lib/membership-utils';

export type RewardTier = {
  id: number;
  minSpend: number | null;
  pointMultiplier: number | null;
  sortOrder: number | null;
};

export function resolveTierForSpend(
  tiers: RewardTier[],
  totalSpend: number,
  fallbackTierId: number,
) {
  const eligible = [...tiers]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .filter(tier => totalSpend >= (tier.minSpend ?? 0));
  return eligible.at(-1)?.id ?? fallbackTierId;
}

export function calculateMembershipOrderReward(input: {
  subtotal: number;
  currentPoints: number;
  currentTotalSpend: number;
  currentTierId: number;
  tiers: RewardTier[];
}) {
  const currentTier = input.tiers.find(tier => tier.id === input.currentTierId);
  const pointsEarned = calculatePointsEarned(
    Math.max(0, input.subtotal),
    currentTier?.pointMultiplier ?? 1,
  );
  const totalSpend = input.currentTotalSpend + Math.max(0, Math.round(input.subtotal));

  return {
    pointsEarned,
    points: input.currentPoints + pointsEarned,
    totalSpend,
    tierId: resolveTierForSpend(input.tiers, totalSpend, input.currentTierId),
  };
}

export function calculateReturnPointsTarget(input: {
  pointsEarned: number;
  orderTotal: number;
  cumulativeRefund: number;
}) {
  if (input.pointsEarned <= 0 || input.orderTotal <= 0) return 0;
  const refundedRatio = Math.min(1, Math.max(0, input.cumulativeRefund) / input.orderTotal);
  return Math.min(input.pointsEarned, Math.round(input.pointsEarned * refundedRatio));
}

export function calculateReturnSpendTarget(input: {
  orderSubtotal: number;
  orderTotal: number;
  cumulativeRefund: number;
}) {
  if (input.orderSubtotal <= 0 || input.orderTotal <= 0) return 0;
  const refundedRatio = Math.min(1, Math.max(0, input.cumulativeRefund) / input.orderTotal);
  return Math.min(input.orderSubtotal, Math.round(input.orderSubtotal * refundedRatio));
}
