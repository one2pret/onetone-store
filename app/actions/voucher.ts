'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { memberships, vouchers } from '@/lib/db/schema';
import { and, eq, isNull, or, lte, gte, sql } from 'drizzle-orm';
import { calculateDiscount } from '@/lib/membership-utils';

export type AvailableVoucher = {
  id: number;
  code: string;
  type: 'fixed' | 'percent' | 'free_shipping';
  value: number;
  discountAmount: number;
  freeShipping: boolean;
  endsAt: Date | null;
  minSpend: number;
};

export async function getAvailableVouchers(subtotal: number): Promise<AvailableVoucher[]> {
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;

  // Get user tier
  let userTierId: number | null = null;
  if (userId) {
    const membership = await db
      .select({ tierId: memberships.tierId })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null);
    userTierId = membership?.tierId ?? null;
  }

  const now = new Date();
  const allActive = await db
    .select()
    .from(vouchers)
    .where(eq(vouchers.isActive, true));

  return allActive
    .filter((v) => {
      // Tanggal
      if (v.startsAt && now < new Date(v.startsAt)) return false;
      if (v.endsAt && now > new Date(v.endsAt)) return false;
      // Kuota
      if (v.quota !== null && (v.usedCount ?? 0) >= v.quota) return false;
      // Min spend
      if ((v.minSpend ?? 0) > 0 && subtotal < (v.minSpend ?? 0)) return false;
      // Tier
      if (v.tierId !== null) {
        if (!userTierId || userTierId < v.tierId) return false;
      }
      return true;
    })
    .map((v) => {
      const type = v.type as 'fixed' | 'percent' | 'free_shipping';
      return {
        id: v.id,
        code: v.code,
        type,
        value: v.value ?? 0,
        discountAmount: calculateDiscount(type, v.value ?? 0, subtotal),
        freeShipping: type === 'free_shipping',
        endsAt: v.endsAt ? new Date(v.endsAt) : null,
        minSpend: v.minSpend ?? 0,
      };
    });
}

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
