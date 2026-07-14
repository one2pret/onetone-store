'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { memberships, vouchers } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { calculateDiscount } from '@/lib/membership-utils';

export type VoucherValidationResult =
  | { valid: false; error: string }
  | {
      valid: true;
      voucherId: number;
      code: string;
      type: 'fixed' | 'percent' | 'free_shipping';
      discountAmount: number;
      freeShipping: boolean;
      message: string;
    };

export async function validateVoucher(
  code: string,
  subtotal: number
): Promise<VoucherValidationResult> {
  if (!code.trim()) return { valid: false, error: 'Masukkan kode voucher' };

  const voucher = await db
    .select()
    .from(vouchers)
    .where(and(eq(vouchers.code, code.trim().toUpperCase()), eq(vouchers.isActive, true)))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!voucher) return { valid: false, error: 'Kode voucher tidak ditemukan' };

  const now = new Date();
  if (voucher.startsAt && now < new Date(voucher.startsAt))
    return { valid: false, error: 'Voucher belum aktif' };
  if (voucher.endsAt && now > new Date(voucher.endsAt))
    return { valid: false, error: 'Voucher sudah expired' };

  if (voucher.quota !== null && (voucher.usedCount ?? 0) >= voucher.quota)
    return { valid: false, error: 'Kuota voucher sudah habis' };

  if ((voucher.minSpend ?? 0) > 0 && subtotal < (voucher.minSpend ?? 0))
    return {
      valid: false,
      error: `Minimum belanja Rp ${(voucher.minSpend ?? 0).toLocaleString('id-ID')} untuk memakai voucher ini`,
    };

  if (voucher.tierId) {
    const session = await auth();
    if (!session?.user) return { valid: false, error: 'Login untuk memakai voucher tier' };

    const userId = Number(session.user.id);
    const membership = await db
      .select({ tierId: memberships.tierId })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!membership || membership.tierId < voucher.tierId)
      return { valid: false, error: 'Tier membership kamu belum memenuhi syarat voucher ini' };
  }

  const type = voucher.type as 'fixed' | 'percent' | 'free_shipping';
  const discountAmount = calculateDiscount(type, voucher.value ?? 0, subtotal);
  const freeShipping = type === 'free_shipping';

  const message = freeShipping
    ? 'Gratis ongkos kirim diterapkan!'
    : `Diskon Rp ${discountAmount.toLocaleString('id-ID')} diterapkan`;

  return {
    valid: true,
    voucherId: voucher.id,
    code: voucher.code,
    type,
    discountAmount,
    freeShipping,
    message,
  };
}
