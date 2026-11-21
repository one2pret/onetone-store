import { and, eq, isNull } from 'drizzle-orm';
import { memberships, userVouchers, vouchers } from '@/lib/db/schema';
import { calculateDiscount } from '@/lib/membership-utils';
import type { CheckoutTransaction } from './transactional-membership-points';

export class CheckoutVoucherError extends Error {}

/** The caller must already hold the checkout user lock. No provider calls. */
export async function loadCheckoutVoucher(
  tx: CheckoutTransaction,
  args: { userId: number; voucherId: number; subtotal: number },
) {
  if (!Number.isSafeInteger(args.voucherId) || args.voucherId <= 0) {
    throw new CheckoutVoucherError('Voucher tidak valid');
  }
  const [voucher] = await tx.select().from(vouchers)
    .where(eq(vouchers.id, args.voucherId)).for('update').limit(1);
  const [grant] = await tx.select().from(userVouchers).where(and(
    eq(userVouchers.userId, args.userId), eq(userVouchers.voucherId, args.voucherId),
  )).for('update').limit(1);
  const now = new Date();
  if (!voucher || voucher.isActive !== true || voucher.archivedAt ||
      voucher.audience !== 'new_user' || voucher.quota !== null ||
      voucher.maxUsesPerUser !== 1 || voucher.firstOrderOnly || voucher.storeId !== null ||
      (voucher.startsAt && now < voucher.startsAt) ||
      (voucher.endsAt && now > voucher.endsAt) ||
      !Number.isSafeInteger(voucher.minSpend ?? 0) || (voucher.minSpend ?? 0) < 0 ||
      args.subtotal < (voucher.minSpend ?? 0) ||
      !Number.isSafeInteger(voucher.value ?? 0) || (voucher.value ?? 0) < 0 ||
      (voucher.type === 'percent' && (voucher.value ?? 0) > 100)) {
    throw new CheckoutVoucherError('Voucher tidak tersedia atau kebijakannya belum didukung');
  }
  if (!grant || grant.status !== 'available' || grant.reservedOrderId !== null ||
      grant.redeemedOrderId !== null || (grant.expiresAt && now > grant.expiresAt)) {
    throw new CheckoutVoucherError('Voucher tidak dimiliki, kedaluwarsa, atau sudah digunakan');
  }
  if (voucher.tierId !== null) {
    const [member] = await tx.select({ tierId: memberships.tierId }).from(memberships)
      .where(eq(memberships.userId, args.userId)).for('update').limit(1);
    if (!member || member.tierId < voucher.tierId) throw new CheckoutVoucherError('Tier tidak memenuhi syarat');
  }
  return {
    voucherId: voucher.id, grantId: grant.id,
    discountAmount: calculateDiscount(voucher.type, voucher.value ?? 0, args.subtotal),
    freeShipping: voucher.type === 'free_shipping', allowPoints: voucher.allowPoints,
  };
}

/** Called only after order insert, inside the same transaction. */
export async function reserveCheckoutVoucher(tx: CheckoutTransaction, args: {
  userId: number; grantId: number; orderId: number; now: Date;
}) {
  const [result] = await tx.update(userVouchers).set({
    status: 'reserved', reservedOrderId: args.orderId, reservedAt: args.now,
  }).where(and(eq(userVouchers.id, args.grantId), eq(userVouchers.userId, args.userId),
    eq(userVouchers.status, 'available'), isNull(userVouchers.reservedOrderId),
    isNull(userVouchers.redeemedOrderId)));
  if (result.affectedRows !== 1) throw new CheckoutVoucherError('Voucher sudah digunakan');
}
