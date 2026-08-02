// app/actions/affiliate.ts
'use server';

import { db } from '@/lib/db';
import {
  affiliates, affiliateLinks, affiliateClicks, affiliateCommissions,
  affiliatePayouts, affiliateSettings,
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
