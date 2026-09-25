'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { memberships, orders, userVouchers, vouchers } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
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
  userVoucherId?: number;
  audience: 'public' | 'membership' | 'new_user';
};

export async function getAvailableVouchers(subtotal: number): Promise<AvailableVoucher[]> {
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;

  // Get user tier
  let userTierId: number | null = null;
  const grants = userId
    ? await db.select().from(userVouchers).where(eq(userVouchers.userId, userId))
    : [];
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
      if (v.audience === 'new_user') {
        const grant = grants.find((item) => item.voucherId === v.id);
        if (!grant || grant.status !== 'available') return false;
        if (grant.expiresAt && now > new Date(grant.expiresAt)) return false;
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
        userVoucherId: grants.find((item) => item.voucherId === v.id)?.id,
        audience: v.audience,
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
      userVoucherId: number | null;
      allowPoints: boolean;
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

  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : null;

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
    if (!session?.user) return { valid: false, error: 'Login untuk memakai voucher tier' };

    const membership = await db
      .select({ tierId: memberships.tierId })
      .from(memberships)
      .where(eq(memberships.userId, userId!))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!membership || membership.tierId < voucher.tierId)
      return { valid: false, error: 'Tier membership kamu belum memenuhi syarat voucher ini' };
  }

  let userVoucherId: number | null = null;
  if (voucher.audience === 'new_user') {
    if (!userId) return { valid: false, error: 'Login untuk memakai voucher pengguna baru' };
    const grant = await db.select().from(userVouchers).where(and(
      eq(userVouchers.userId, userId),
      eq(userVouchers.voucherId, voucher.id),
    )).limit(1).then((rows) => rows[0] ?? null);

    if (!grant) return { valid: false, error: 'Voucher ini tidak diberikan ke akun Anda' };
    if (grant.status === 'reserved') return { valid: false, error: 'Voucher sedang digunakan pada pesanan lain' };
    if (grant.status === 'redeemed') return { valid: false, error: 'Voucher sudah pernah digunakan' };
    if (grant.status === 'expired' || (grant.expiresAt && now > new Date(grant.expiresAt))) {
      return { valid: false, error: 'Voucher sudah expired' };
    }

    if (voucher.firstOrderOnly) {
      const completedOrders = await db.select({ id: orders.id }).from(orders).where(and(
        eq(orders.userId, userId),
        inArray(orders.status, ['packing', 'shipping', 'delivered']),
      )).limit(1);
      if (completedOrders.length > 0) {
        return { valid: false, error: 'Voucher hanya berlaku untuk pesanan pertama' };
      }
    }
    userVoucherId = grant.id;
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
    userVoucherId,
    allowPoints: voucher.allowPoints,
  };
}
