import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userVouchers } from '@/lib/db/schema';

export async function redeemVoucherReservation(orderId: number) {
  await db.update(userVouchers).set({
    status: 'redeemed',
    redeemedOrderId: orderId,
    redeemedAt: new Date(),
  }).where(and(
    eq(userVouchers.reservedOrderId, orderId),
    eq(userVouchers.status, 'reserved'),
  ));
}

export async function releaseVoucherReservation(orderId: number) {
  await db.update(userVouchers).set({
    status: sql`CASE WHEN ${userVouchers.expiresAt} IS NOT NULL AND ${userVouchers.expiresAt} < NOW() THEN 'expired' ELSE 'available' END`,
    reservedOrderId: null,
    reservedAt: null,
  }).where(and(
    eq(userVouchers.reservedOrderId, orderId),
    eq(userVouchers.status, 'reserved'),
  ));
}
