import { db } from "@/lib/db";
import { memberships, orders, userVouchers, vouchers } from "@/lib/db/schema";
import { calculateDiscount } from "@/lib/membership-utils";
import { and, eq, gt, inArray } from "drizzle-orm";

export type PosMemberVoucher = {
  userVoucherId: number;
  voucherId: number;
  code: string;
  name: string | null;
  type: "fixed" | "percent";
  value: number;
  minSpend: number;
  discountAmount: number;
  expiresAt: Date | null;
};

type VoucherCandidate = {
  userVoucherId: number;
  userId: number;
  status: "available" | "reserved" | "redeemed" | "expired";
  grantedAt: Date;
  expiresAt: Date | null;
  voucherId: number;
  code: string;
  name: string | null;
  type: "fixed" | "percent" | "free_shipping";
  value: number | null;
  minSpend: number | null;
  tierId: number | null;
  quota: number | null;
  usedCount: number | null;
  firstOrderOnly: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean | null;
  archivedAt: Date | null;
  allowPoints: boolean;
};

async function getCandidate(userId: number, userVoucherId: number) {
  const rows = await db.select({
    userVoucherId: userVouchers.id,
    userId: userVouchers.userId,
    status: userVouchers.status,
    grantedAt: userVouchers.grantedAt,
    expiresAt: userVouchers.expiresAt,
    voucherId: vouchers.id,
    code: vouchers.code,
    name: vouchers.name,
    type: vouchers.type,
    value: vouchers.value,
    minSpend: vouchers.minSpend,
    tierId: vouchers.tierId,
    quota: vouchers.quota,
    usedCount: vouchers.usedCount,
    firstOrderOnly: vouchers.firstOrderOnly,
    startsAt: vouchers.startsAt,
    endsAt: vouchers.endsAt,
    isActive: vouchers.isActive,
    archivedAt: vouchers.archivedAt,
    allowPoints: vouchers.allowPoints,
  }).from(userVouchers)
    .innerJoin(vouchers, eq(vouchers.id, userVouchers.voucherId))
    .where(and(eq(userVouchers.id, userVoucherId), eq(userVouchers.userId, userId)))
    .limit(1);
  return rows[0] as VoucherCandidate | undefined;
}

async function eligibilityError(candidate: VoucherCandidate, userTierId: number, subtotal: number) {
  const now = new Date();
  if (candidate.status !== "available") return "Voucher sudah digunakan atau sedang dipakai";
  if (!candidate.isActive || candidate.archivedAt) return "Voucher tidak aktif";
  if (candidate.type === "free_shipping") return "Voucher gratis ongkir tidak berlaku di POS";
  if (candidate.startsAt && now < candidate.startsAt) return "Voucher belum aktif";
  if (candidate.endsAt && now > candidate.endsAt) return "Voucher sudah kedaluwarsa";
  if (candidate.expiresAt && now > candidate.expiresAt) return "Voucher member sudah kedaluwarsa";
  if (candidate.quota !== null && (candidate.usedCount ?? 0) >= candidate.quota) return "Kuota voucher sudah habis";
  if ((candidate.minSpend ?? 0) > subtotal) return `Minimum belanja Rp${(candidate.minSpend ?? 0).toLocaleString("id-ID")}`;
  if (candidate.tierId !== null && userTierId < candidate.tierId) return "Tier member belum memenuhi syarat";
  if (candidate.firstOrderOnly) {
    const priorOrders = await db.select({ id: orders.id }).from(orders).where(and(
      eq(orders.userId, candidate.userId),
      inArray(orders.status, ["packing", "shipping", "delivered"]),
      gt(orders.createdAt, candidate.grantedAt),
    )).limit(1);
    if (priorOrders.length > 0) return "Voucher hanya berlaku untuk transaksi pertama";
  }
  return null;
}

export async function getEligiblePosMemberVouchers(userId: number, subtotal: number): Promise<PosMemberVoucher[]> {
  const membershipRows = await db.select({ tierId: memberships.tierId }).from(memberships)
    .where(eq(memberships.userId, userId)).limit(1);
  const membership = membershipRows[0];
  if (!membership) return [];

  const grants = await db.select({ id: userVouchers.id }).from(userVouchers)
    .where(and(eq(userVouchers.userId, userId), eq(userVouchers.status, "available")));
  const eligible: PosMemberVoucher[] = [];
  for (const grant of grants) {
    const candidate = await getCandidate(userId, grant.id);
    if (!candidate || await eligibilityError(candidate, membership.tierId, subtotal)) continue;
    const type = candidate.type as "fixed" | "percent";
    eligible.push({
      userVoucherId: candidate.userVoucherId,
      voucherId: candidate.voucherId,
      code: candidate.code,
      name: candidate.name,
      type,
      value: candidate.value ?? 0,
      minSpend: candidate.minSpend ?? 0,
      discountAmount: calculateDiscount(type, candidate.value ?? 0, subtotal),
      expiresAt: candidate.expiresAt ?? candidate.endsAt,
    });
  }
  return eligible;
}

export async function validatePosMemberVoucher(userId: number, userVoucherId: number, subtotal: number) {
  const membershipRows = await db.select({ tierId: memberships.tierId }).from(memberships)
    .where(eq(memberships.userId, userId)).limit(1);
  const membership = membershipRows[0];
  if (!membership) return { valid: false as const, error: "Member tidak aktif" };
  const candidate = await getCandidate(userId, userVoucherId);
  if (!candidate) return { valid: false as const, error: "Voucher bukan milik member yang dipilih" };
  const error = await eligibilityError(candidate, membership.tierId, subtotal);
  if (error) return { valid: false as const, error };
  const type = candidate.type as "fixed" | "percent";
  return {
    valid: true as const,
    userVoucherId: candidate.userVoucherId,
    voucherId: candidate.voucherId,
    code: candidate.code,
    discountAmount: calculateDiscount(type, candidate.value ?? 0, subtotal),
    allowPoints: candidate.allowPoints,
  };
}
