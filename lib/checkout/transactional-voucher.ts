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
  if (!voucher || !isSupportedVoucher(voucher, args.subtotal, now)) {
    throw new CheckoutVoucherError('Voucher tidak tersedia atau kebijakannya belum didukung');
  }
  if (!grant || grant.status !== 'available' || grant.reservedOrderId !== null ||
      grant.redeemedOrderId !== null || !isGrantCurrent(grant, voucher, now)) {
    throw new CheckoutVoucherError('Voucher tidak dimiliki, kedaluwarsa, atau sudah digunakan');
  }
  if (!await meetsVoucherTier(tx, args.userId, voucher.tierId)) {
    throw new CheckoutVoucherError('Tier tidak memenuhi syarat');
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

function isSupportedVoucher(voucher: typeof vouchers.$inferSelect, subtotal: number, now: Date) {
  const minSpend = voucher.minSpend ?? 0;
  const value = voucher.value ?? 0;
  return voucher.isActive === true && !voucher.archivedAt &&
    voucher.audience === 'new_user' && voucher.quota === null &&
    voucher.maxUsesPerUser === 1 && !voucher.firstOrderOnly && voucher.storeId === null &&
    (!voucher.startsAt || now >= voucher.startsAt) && (!voucher.endsAt || now <= voucher.endsAt) &&
    Number.isSafeInteger(minSpend) && minSpend >= 0 && subtotal >= minSpend &&
    Number.isSafeInteger(value) && value >= 0 && (voucher.type !== 'percent' || value <= 100);
}

function isGrantCurrent(
  grant: Pick<typeof userVouchers.$inferSelect, 'expiresAt'>,
  voucher: Pick<typeof vouchers.$inferSelect, 'validDaysAfterGrant'>,
  now: Date,
) {
  return grant.expiresAt ? now <= grant.expiresAt : voucher.validDaysAfterGrant === null;
}

async function meetsVoucherTier(tx: CheckoutTransaction, userId: number, tierId: number | null) {
  if (tierId === null) return true;
  const [member] = await tx.select({ tierId: memberships.tierId }).from(memberships)
    .where(eq(memberships.userId, userId)).for('update').limit(1);
  return !!member && member.tierId >= tierId;
}

/** Apply a fresh, identity-checked terminal invoice transition with the order locked. */
export async function settleCheckoutVoucher(tx: CheckoutTransaction, args: {
  orderId: number; userId: number | null; voucherId: number; subtotal: number;
  outcome: 'paid' | 'expired';
}) {
  const { orderId, userId, voucherId, subtotal, outcome } = args;
  if (userId === null) throw new CheckoutVoucherError('Voucher reservation requires reconciliation');

  const [voucher] = await tx.select().from(vouchers)
    .where(eq(vouchers.id, voucherId)).for('update').limit(1);
  const owner = and(eq(userVouchers.userId, userId), eq(userVouchers.voucherId, voucherId));
  const [grant] = await tx.select().from(userVouchers).where(owner).for('update').limit(1);
  if (!voucher || !grant || grant.status !== 'reserved' || grant.reservedOrderId !== orderId ||
      !grant.reservedAt || grant.redeemedOrderId !== null || grant.redeemedAt !== null) {
    throw new CheckoutVoucherError('Voucher reservation requires reconciliation');
  }

  let reusable = false;
  if (outcome === 'expired') {
    const meetsTier = await meetsVoucherTier(tx, userId, voucher.tierId);
    const now = new Date();
    reusable = meetsTier && isSupportedVoucher(voucher, subtotal, now) &&
      isGrantCurrent(grant, voucher, now);
  }

  // A paid invoice settles the original discount even if the grant later expired.
  const update = outcome === 'paid'
    ? { status: 'redeemed' as const, redeemedOrderId: orderId, redeemedAt: new Date() }
    : { status: reusable ? 'available' as const : 'expired' as const, reservedOrderId: null, reservedAt: null };
  const [updated] = await tx.update(userVouchers).set(update).where(and(
    owner, eq(userVouchers.id, grant.id), eq(userVouchers.status, 'reserved'),
    eq(userVouchers.reservedOrderId, orderId), isNull(userVouchers.redeemedOrderId),
  ));
  if (updated.affectedRows !== 1) throw new CheckoutVoucherError('Voucher reservation requires reconciliation');
}
