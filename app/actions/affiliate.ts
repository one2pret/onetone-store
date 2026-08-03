// app/actions/affiliate.ts
'use server';

import { db } from '@/lib/db';
import {
  affiliates, affiliateLinks, affiliateClicks, affiliateCommissions,
  affiliatePayouts, affiliateSettings, commissionRules, users, orders,
} from '@/lib/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';
import { generateUniqueAffiliateCode } from '@/lib/affiliate/code-generator';
import { generateOrderNumber } from '@/lib/utils';

async function requireUserId(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Silakan login terlebih dahulu');
  return Number(session.user.id);
}

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    throw new Error('Hanya admin yang dapat melakukan aksi ini');
  }
}

export async function getMyAffiliate() {
  const userId = await requireUserId();
  return db.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1).then((r) => r[0] ?? null);
}

export async function getAffiliateSettings() {
  return db.select().from(affiliateSettings).limit(1).then((r) => r[0] ?? null);
}

export async function registerAffiliate(prevState: any, formData: FormData) {
  const userId = await requireUserId();

  const existing = await db.select({ id: affiliates.id }).from(affiliates)
    .where(eq(affiliates.userId, userId)).limit(1);
  if (existing.length > 0) {
    return { success: false, error: 'Kamu sudah terdaftar sebagai affiliate' };
  }

  const settings = await getAffiliateSettings();
  if (settings && !settings.isEnabled) {
    return { success: false, error: 'Program affiliate sedang tidak dibuka' };
  }

  const displayName = ((formData.get('displayName') as string) || '').trim();
  const instagram = ((formData.get('instagram') as string) || '').trim();
  const tiktok = ((formData.get('tiktok') as string) || '').trim();
  const youtube = ((formData.get('youtube') as string) || '').trim();
  const audienceSize = Number(formData.get('audienceSize') || 0);
  const motivation = ((formData.get('motivation') as string) || '').trim();

  if (!displayName) {
    return { success: false, error: 'Nama publik wajib diisi' };
  }

  const code = await generateUniqueAffiliateCode(displayName);
  const autoApprove = settings?.autoApproveRegistration ?? false;

  await db.insert(affiliates).values({
    userId,
    code,
    displayName,
    status: autoApprove ? 'active' : 'pending',
    socialMedia: JSON.stringify({ instagram, tiktok, youtube }),
    audienceSize: audienceSize || null,
    motivation: motivation || null,
    approvedAt: autoApprove ? sql`NOW()` : null,
  });

  revalidatePath('/affiliate');
  return { success: true };
}

// ============ LINKS ============

export async function getMyLinks() {
  const userId = await requireUserId();
  const affiliate = await getMyAffiliate();
  if (!affiliate) return [];

  return db.select().from(affiliateLinks)
    .where(eq(affiliateLinks.affiliateId, affiliate.id))
    .orderBy(desc(affiliateLinks.createdAt));
}

export async function createAffiliateLink(prevState: any, formData: FormData) {
  const affiliate = await getMyAffiliate();
  if (!affiliate || affiliate.status !== 'active') {
    return { success: false, error: 'Akun affiliate belum aktif' };
  }

  const targetType = (formData.get('targetType') as string) as 'home' | 'product' | 'category' | 'custom';
  const targetId = formData.get('targetId') ? Number(formData.get('targetId')) : null;
  const targetPath = ((formData.get('targetPath') as string) || '').trim() || null;
  const label = ((formData.get('label') as string) || '').trim() || null;
  const utmCampaign = ((formData.get('utmCampaign') as string) || '').trim() || null;

  if (targetType === 'custom' && !targetPath) {
    return { success: false, error: 'Path tujuan wajib diisi untuk link custom' };
  }
  if ((targetType === 'product' || targetType === 'category') && !targetId) {
    return { success: false, error: 'Pilih produk/kategori tujuan' };
  }

  const slug = nanoid(8);

  await db.insert(affiliateLinks).values({
    affiliateId: affiliate.id,
    slug,
    targetType: targetType || 'home',
    targetId,
    targetPath,
    label,
    utmSource: 'affiliate',
    utmMedium: 'referral',
    utmCampaign,
  });

  revalidatePath('/affiliate/dashboard/links');
  return { success: true, slug };
}

export async function deactivateAffiliateLink(linkId: number) {
  const affiliate = await getMyAffiliate();
  if (!affiliate) return { success: false, error: 'Bukan affiliate' };

  await db.update(affiliateLinks)
    .set({ isActive: false })
    .where(and(eq(affiliateLinks.id, linkId), eq(affiliateLinks.affiliateId, affiliate.id)));

  revalidatePath('/affiliate/dashboard/links');
  return { success: true };
}

// ============ STATS & COMMISSIONS ============

export type AffiliateBalance = {
  saldoTertahan: number;
  saldoTersedia: number;
  totalDitarik: number;
};

export async function getMyBalance(): Promise<AffiliateBalance> {
  const affiliate = await getMyAffiliate();
  if (!affiliate) return { saldoTertahan: 0, saldoTersedia: 0, totalDitarik: 0 };

  const rows = await db.select({
    saldoTertahan: sql<string>`COALESCE(SUM(CASE WHEN ${affiliateCommissions.status} IN ('pending','holding') THEN ${affiliateCommissions.amount} END), 0)`,
    saldoTersedia: sql<string>`COALESCE(SUM(CASE WHEN ${affiliateCommissions.status} = 'approved' THEN ${affiliateCommissions.amount} END), 0)`,
    totalDitarik: sql<string>`COALESCE(SUM(CASE WHEN ${affiliateCommissions.status} = 'paid' THEN ${affiliateCommissions.amount} END), 0)`,
  }).from(affiliateCommissions).where(eq(affiliateCommissions.affiliateId, affiliate.id));

  const row = rows[0];
  return {
    saldoTertahan: Number(row?.saldoTertahan ?? 0),
    saldoTersedia: Number(row?.saldoTersedia ?? 0),
    totalDitarik: Number(row?.totalDitarik ?? 0),
  };
}

export async function getMyStats() {
  const affiliate = await getMyAffiliate();
  if (!affiliate) return { totalClicks: 0, totalConversions: 0, conversionRate: 0 };

  const [clickRow] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(affiliateClicks).where(eq(affiliateClicks.affiliateId, affiliate.id));
  const [convRow] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(affiliateClicks)
    .where(and(eq(affiliateClicks.affiliateId, affiliate.id), sql`${affiliateClicks.convertedOrderId} IS NOT NULL`));

  const totalClicks = Number(clickRow?.count ?? 0);
  const totalConversions = Number(convRow?.count ?? 0);
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  return { totalClicks, totalConversions, conversionRate };
}

export async function getMyCommissions(status?: string) {
  const affiliate = await getMyAffiliate();
  if (!affiliate) return [];

  const conditions = [eq(affiliateCommissions.affiliateId, affiliate.id)];
  if (status) conditions.push(eq(affiliateCommissions.status, status as any));

  return db.select().from(affiliateCommissions)
    .where(and(...conditions))
    .orderBy(desc(affiliateCommissions.createdAt))
    .limit(100);
}

// ============ PAYOUTS ============

export async function getMyPayouts() {
  const affiliate = await getMyAffiliate();
  if (!affiliate) return [];

  return db.select().from(affiliatePayouts)
    .where(eq(affiliatePayouts.affiliateId, affiliate.id))
    .orderBy(desc(affiliatePayouts.createdAt));
}

export async function requestPayout(prevState: any, formData: FormData) {
  const affiliate = await getMyAffiliate();
  if (!affiliate || affiliate.status !== 'active') {
    return { success: false, error: 'Akun affiliate belum aktif' };
  }

  if (!affiliate.bankCode || !affiliate.bankAccountNumber || !affiliate.bankAccountName) {
    return { success: false, error: 'Lengkapi data rekening di halaman Pengaturan dulu' };
  }

  const pendingPayout = await db.select({ id: affiliatePayouts.id }).from(affiliatePayouts)
    .where(and(
      eq(affiliatePayouts.affiliateId, affiliate.id),
      inArray(affiliatePayouts.status, ['requested', 'approved', 'processing']),
    )).limit(1);
  if (pendingPayout.length > 0) {
    return { success: false, error: 'Masih ada permintaan withdraw yang belum selesai' };
  }

  const settings = await getAffiliateSettings();
  const minPayout = Number(settings?.minPayoutAmount ?? 50000);
  const adminFee = Number(settings?.payoutAdminFee ?? 0);

  const balance = await getMyBalance();
  if (balance.saldoTersedia < minPayout) {
    return { success: false, error: `Saldo minimum withdraw Rp${minPayout.toLocaleString('id-ID')}` };
  }

  const amount = balance.saldoTersedia;
  const netAmount = amount - adminFee;
  const payoutNumber = `PO-${generateOrderNumber()}`;

  await db.transaction(async (tx) => {
    const [result] = await tx.insert(affiliatePayouts).values({
      affiliateId: affiliate.id,
      payoutNumber,
      amount: String(amount),
      adminFee: String(adminFee),
      netAmount: String(netAmount),
      bankCode: affiliate.bankCode!,
      bankAccountNumber: affiliate.bankAccountNumber!,
      bankAccountName: affiliate.bankAccountName!,
      status: 'requested',
    });
    const payoutId = Number(result.insertId);

    await tx.update(affiliateCommissions)
      .set({ status: 'paid', payoutId })
      .where(and(
        eq(affiliateCommissions.affiliateId, affiliate.id),
        eq(affiliateCommissions.status, 'approved'),
      ));
  });

  revalidatePath('/affiliate/dashboard/payouts');
  return { success: true };
}

export async function updateBankAccount(prevState: any, formData: FormData) {
  const affiliate = await getMyAffiliate();
  if (!affiliate) return { success: false, error: 'Bukan affiliate' };

  const bankCode = ((formData.get('bankCode') as string) || '').trim();
  const bankAccountNumber = ((formData.get('bankAccountNumber') as string) || '').trim();
  const bankAccountName = ((formData.get('bankAccountName') as string) || '').trim();
  const npwp = ((formData.get('npwp') as string) || '').trim() || null;

  if (!bankCode || !bankAccountNumber || !bankAccountName) {
    return { success: false, error: 'Semua field rekening wajib diisi' };
  }

  await db.update(affiliates)
    .set({ bankCode, bankAccountNumber, bankAccountName, npwp })
    .where(eq(affiliates.id, affiliate.id));

  revalidatePath('/affiliate/dashboard/settings');
  return { success: true };
}

// ============ ADMIN ============

export async function getAdminOverview() {
  await requireAdmin();

  const [affiliateCounts] = await db.select({
    total: sql<number>`COUNT(*)`,
    active: sql<number>`SUM(CASE WHEN ${affiliates.status} = 'active' THEN 1 ELSE 0 END)`,
    pending: sql<number>`SUM(CASE WHEN ${affiliates.status} = 'pending' THEN 1 ELSE 0 END)`,
  }).from(affiliates);

  const [gmvRow] = await db.select({
    gmv: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
  }).from(orders).where(sql`${orders.affiliateId} IS NOT NULL AND ${orders.status} != 'cancelled' AND ${orders.status} != 'expired'`);

  const [commissionOwed] = await db.select({
    owed: sql<string>`COALESCE(SUM(CASE WHEN ${affiliateCommissions.status} IN ('pending','holding','approved') THEN ${affiliateCommissions.amount} END), 0)`,
  }).from(affiliateCommissions);

  return {
    totalAffiliates: Number(affiliateCounts?.total ?? 0),
    activeAffiliates: Number(affiliateCounts?.active ?? 0),
    pendingAffiliates: Number(affiliateCounts?.pending ?? 0),
    gmvFromAffiliates: Number(gmvRow?.gmv ?? 0),
    commissionOwed: Number(commissionOwed?.owed ?? 0),
  };
}

export async function getAllAffiliates(status?: string) {
  await requireAdmin();

  const conditions = status ? [eq(affiliates.status, status as any)] : [];

  const rows = await db.select().from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(affiliates.createdAt));

  return rows.map((r) => ({ ...r.affiliates, user: r.users }));
}

export async function getAffiliateDetail(id: number) {
  await requireAdmin();

  const row = await db.select().from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(eq(affiliates.id, id)).limit(1).then((r) => r[0] ?? null);
  if (!row) return null;

  const [commissions, payouts, linkCount] = await Promise.all([
    db.select().from(affiliateCommissions).where(eq(affiliateCommissions.affiliateId, id)).orderBy(desc(affiliateCommissions.createdAt)).limit(50),
    db.select().from(affiliatePayouts).where(eq(affiliatePayouts.affiliateId, id)).orderBy(desc(affiliatePayouts.createdAt)),
    db.select({ count: sql<number>`COUNT(*)` }).from(affiliateLinks).where(eq(affiliateLinks.affiliateId, id)),
  ]);

  return {
    ...row.affiliates,
    user: row.users,
    commissions,
    payouts,
    linkCount: Number(linkCount[0]?.count ?? 0),
  };
}

export async function approveAffiliate(id: number) {
  await requireAdmin();
  const session = await auth();

  await db.update(affiliates)
    .set({ status: 'active', approvedAt: sql`NOW()`, approvedBy: Number(session!.user!.id) })
    .where(eq(affiliates.id, id));

  revalidatePath('/dashboard/affiliate/members');
  return { success: true };
}

export async function rejectAffiliate(id: number) {
  await requireAdmin();

  await db.update(affiliates)
    .set({ status: 'rejected' })
    .where(eq(affiliates.id, id));

  revalidatePath('/dashboard/affiliate/members');
  return { success: true };
}

export async function suspendAffiliate(prevState: any, formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  const reason = ((formData.get('reason') as string) || '').trim();
  if (!reason) return { success: false, error: 'Alasan pembekuan wajib diisi' };

  await db.update(affiliates)
    .set({ status: 'suspended', suspendedAt: sql`NOW()`, suspendReason: reason })
    .where(eq(affiliates.id, id));

  revalidatePath('/dashboard/affiliate/members');
  return { success: true };
}

export async function reactivateAffiliate(id: number) {
  await requireAdmin();

  await db.update(affiliates)
    .set({ status: 'active', suspendedAt: null, suspendReason: null })
    .where(eq(affiliates.id, id));

  revalidatePath('/dashboard/affiliate/members');
  return { success: true };
}

export async function getAllCommissions(status?: string) {
  await requireAdmin();

  const conditions = status ? [eq(affiliateCommissions.status, status as any)] : [];

  const rows = await db.select().from(affiliateCommissions)
    .leftJoin(affiliates, eq(affiliateCommissions.affiliateId, affiliates.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(affiliateCommissions.createdAt))
    .limit(200);

  return rows.map((r) => ({ ...r.affiliate_commissions, affiliate: r.affiliates }));
}

export async function adjustCommission(prevState: any, formData: FormData) {
  await requireAdmin();

  const affiliateId = Number(formData.get('affiliateId'));
  const orderId = Number(formData.get('orderId')) || null;
  const amount = Number(formData.get('amount'));
  const reason = ((formData.get('reason') as string) || '').trim();

  if (!affiliateId || !amount || !reason) {
    return { success: false, error: 'Affiliate, nominal, dan alasan wajib diisi' };
  }
  if (!orderId) {
    return { success: false, error: 'Order ID wajib diisi untuk adjustment' };
  }

  await db.insert(affiliateCommissions).values({
    affiliateId,
    orderId,
    entryType: 'adjustment',
    baseAmount: '0',
    ratePercent: '0',
    amount: String(amount),
    status: 'approved',
    rejectReason: reason.slice(0, 255),
  });

  revalidatePath('/dashboard/affiliate/commissions');
  return { success: true };
}

export async function getAllPayouts(status?: string) {
  await requireAdmin();

  const conditions = status ? [eq(affiliatePayouts.status, status as any)] : [];

  const rows = await db.select().from(affiliatePayouts)
    .leftJoin(affiliates, eq(affiliatePayouts.affiliateId, affiliates.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(affiliatePayouts.createdAt));

  return rows.map((r) => ({ ...r.affiliate_payouts, affiliate: r.affiliates }));
}

export async function approvePayoutRequest(id: number) {
  await requireAdmin();
  const session = await auth();

  await db.update(affiliatePayouts)
    .set({ status: 'approved', approvedBy: Number(session!.user!.id), approvedAt: sql`NOW()` })
    .where(eq(affiliatePayouts.id, id));

  revalidatePath('/dashboard/affiliate/payouts');
  return { success: true };
}

export async function markPayoutCompleted(id: number) {
  await requireAdmin();

  await db.update(affiliatePayouts)
    .set({ status: 'completed', completedAt: sql`NOW()` })
    .where(eq(affiliatePayouts.id, id));

  revalidatePath('/dashboard/affiliate/payouts');
  return { success: true };
}

export async function rejectPayoutRequest(prevState: any, formData: FormData) {
  await requireAdmin();

  const id = Number(formData.get('id'));
  const reason = ((formData.get('reason') as string) || '').trim();
  if (!reason) return { success: false, error: 'Alasan penolakan wajib diisi' };

  const payout = await db.select().from(affiliatePayouts).where(eq(affiliatePayouts.id, id)).limit(1).then((r) => r[0] ?? null);
  if (!payout) return { success: false, error: 'Payout tidak ditemukan' };

  await db.transaction(async (tx) => {
    await tx.update(affiliatePayouts)
      .set({ status: 'rejected', failureReason: reason.slice(0, 255) })
      .where(eq(affiliatePayouts.id, id));

    // Kembalikan commission yang sempat ditandai 'paid' ke 'approved' — belum jadi ditarik
    await tx.update(affiliateCommissions)
      .set({ status: 'approved', payoutId: null })
      .where(eq(affiliateCommissions.payoutId, id));
  });

  revalidatePath('/dashboard/affiliate/payouts');
  return { success: true };
}

export async function getCommissionRules() {
  await requireAdmin();
  return db.select().from(commissionRules).orderBy(desc(commissionRules.priority));
}

export async function createCommissionRule(prevState: any, formData: FormData) {
  await requireAdmin();

  const scope = formData.get('scope') as 'global' | 'tier' | 'category' | 'product';
  const scopeTier = (formData.get('scopeTier') as string) || null;
  const categoryId = formData.get('categoryId') ? Number(formData.get('categoryId')) : null;
  const productId = formData.get('productId') ? Number(formData.get('productId')) : null;
  const ratePercent = Number(formData.get('ratePercent'));
  const maxCommission = formData.get('maxCommission') ? Number(formData.get('maxCommission')) : null;
  const priority = Number(formData.get('priority') || 0);

  if (!scope || !ratePercent) {
    return { success: false, error: 'Scope dan rate wajib diisi' };
  }
  if (scope === 'tier' && !scopeTier) {
    return { success: false, error: 'Pilih tier untuk scope tier' };
  }
  if (scope === 'category' && !categoryId) {
    return { success: false, error: 'Pilih kategori untuk scope category' };
  }
  if (scope === 'product' && !productId) {
    return { success: false, error: 'Pilih produk untuk scope product' };
  }

  await db.insert(commissionRules).values({
    scope,
    scopeTier: scope === 'tier' ? (scopeTier as any) : null,
    categoryId: scope === 'category' ? categoryId : null,
    productId: scope === 'product' ? productId : null,
    ratePercent: String(ratePercent),
    maxCommission: maxCommission != null ? String(maxCommission) : null,
    priority,
  });

  revalidatePath('/dashboard/affiliate/rules');
  return { success: true };
}

export async function toggleCommissionRule(id: number, isActive: boolean) {
  await requireAdmin();

  await db.update(commissionRules).set({ isActive }).where(eq(commissionRules.id, id));
  revalidatePath('/dashboard/affiliate/rules');
  return { success: true };
}

export async function deleteCommissionRule(id: number) {
  await requireAdmin();

  await db.delete(commissionRules).where(eq(commissionRules.id, id));
  revalidatePath('/dashboard/affiliate/rules');
  return { success: true };
}

export async function updateAffiliateSettings(prevState: any, formData: FormData) {
  await requireAdmin();

  const isEnabled = formData.get('isEnabled') === 'on';
  const autoApproveRegistration = formData.get('autoApproveRegistration') === 'on';
  const allowSelfReferral = formData.get('allowSelfReferral') === 'on';
  const cookieWindowDays = Number(formData.get('cookieWindowDays') || 30);
  const holdPeriodDays = Number(formData.get('holdPeriodDays') || 7);
  const defaultRatePercent = Number(formData.get('defaultRatePercent') || 5);
  const minPayoutAmount = Number(formData.get('minPayoutAmount') || 50000);
  const payoutAdminFee = Number(formData.get('payoutAdminFee') || 0);
  const termsContent = ((formData.get('termsContent') as string) || '').trim() || null;

  const existing = await db.select({ id: affiliateSettings.id }).from(affiliateSettings).limit(1);

  const values = {
    isEnabled,
    autoApproveRegistration,
    allowSelfReferral,
    cookieWindowDays,
    holdPeriodDays,
    defaultRatePercent: String(defaultRatePercent),
    minPayoutAmount: String(minPayoutAmount),
    payoutAdminFee: String(payoutAdminFee),
    termsContent,
  };

  if (existing.length > 0) {
    await db.update(affiliateSettings).set(values).where(eq(affiliateSettings.id, existing[0].id));
  } else {
    await db.insert(affiliateSettings).values(values);
  }

  revalidatePath('/dashboard/affiliate/settings');
  return { success: true };
}
