// lib/affiliate/commission-lifecycle.ts
// Hook komisi ditempel ke transisi order yang sudah ada (webhook Xendit/Bitship,
// cancel action) — bukan di lib/order-status.ts karena file itu sengaja pure
// (validasi transisi doang, tanpa DB). Lihat docs/devs/dev-affiliates/affiliate-module-plan.md §4.3.
import { db } from '@/lib/db';
import { orders, orderItems, products, affiliates, affiliateCommissions, affiliateSettings } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { resolveRate, calculateCommission, getDefaultRatePercent } from '@/lib/affiliate/commission';
import type { AffiliateTier } from '@/lib/affiliate/commission';

/**
 * Dipanggil saat order transisi waiting_payment -> packing (paid).
 * Bikin satu baris affiliate_commissions per order_item, status 'pending'.
 * No-op kalau order tidak punya affiliateId (tidak ada attribution).
 */
export async function createCommissionsForOrder(orderId: number): Promise<void> {
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1).then((r) => r[0] ?? null);
  if (!order || !order.affiliateId) return;

  const affiliate = await db.select().from(affiliates).where(eq(affiliates.id, order.affiliateId)).limit(1).then((r) => r[0] ?? null);
  if (!affiliate || affiliate.status !== 'active') return;

  // Guard idempotency — kalau sudah pernah dibuat (webhook retry), jangan dobel.
  const existing = await db.select({ id: affiliateCommissions.id }).from(affiliateCommissions)
    .where(eq(affiliateCommissions.orderId, orderId)).limit(1);
  if (existing.length > 0) return;

  const items = await db.select().from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) return;

  const orderSubtotal = Number(order.subtotal);
  const orderDiscount = Number(order.discountAmount ?? 0);
  const fallbackRate = await getDefaultRatePercent();

  for (const row of items) {
    const item = row.order_items;
    const product = row.products;
    const itemSubtotal = Number(item.subtotal);

    // Proporsi diskon order untuk item ini — ongkir tidak pernah masuk basis.
    const proportionalDiscount = orderSubtotal > 0 ? orderDiscount * (itemSubtotal / orderSubtotal) : 0;
    const baseAmount = Math.max(0, itemSubtotal - proportionalDiscount);

    const rule = await resolveRate({
      productId: item.productId,
      categoryId: product?.categoryId ?? null,
      tier: affiliate.tier as AffiliateTier,
    });
    const { ratePercent, amount } = calculateCommission(baseAmount, rule, fallbackRate);

    if (amount <= 0) continue;

    await db.insert(affiliateCommissions).values({
      affiliateId: affiliate.id,
      orderId,
      orderItemId: item.id,
      entryType: 'earning',
      baseAmount: String(baseAmount),
      ratePercent: String(ratePercent),
      amount: String(amount),
      ruleId: rule?.id ?? null,
      status: 'pending',
    });
  }
}

/**
 * Dipanggil saat order transisi -> delivered. Komisi pending order ini pindah ke
 * 'holding' dengan holdUntil = now + holdPeriodDays (dari affiliate_settings).
 */
export async function holdCommissionsForOrder(orderId: number): Promise<void> {
  const settings = await db.select({ holdPeriodDays: affiliateSettings.holdPeriodDays })
    .from(affiliateSettings).limit(1).then((r) => r[0] ?? null);
  const holdPeriodDays = settings?.holdPeriodDays ?? 7;

  await db.update(affiliateCommissions)
    .set({
      status: 'holding',
      holdUntil: sql`DATE_ADD(NOW(), INTERVAL ${holdPeriodDays} DAY)`,
    })
    .where(and(
      eq(affiliateCommissions.orderId, orderId),
      eq(affiliateCommissions.status, 'pending'),
    ));
}

/**
 * Dipanggil saat order transisi -> cancelled / expired. Komisi yang masih
 * pending/holding untuk order ini di-reject — TIDAK dihapus, cuma ganti status
 * (ledger, bukan angka yang di-update/dihapus).
 */
export async function rejectCommissionsForOrder(orderId: number, reason: string): Promise<void> {
  await db.update(affiliateCommissions)
    .set({
      status: 'rejected',
      rejectedAt: sql`NOW()`,
      rejectReason: reason.slice(0, 255),
    })
    .where(and(
      eq(affiliateCommissions.orderId, orderId),
      inArray(affiliateCommissions.status, ['pending', 'holding']),
    ));
}

/**
 * Dipanggil saat refund SETELAH komisi approved/paid — insert baris reversal
 * bernilai negatif, bukan update/hapus baris asli (lihat prinsip ledger di §1 plan).
 */
export async function reverseApprovedCommissionsForOrder(orderId: number, reason: string): Promise<void> {
  const rows = await db.select().from(affiliateCommissions)
    .where(and(
      eq(affiliateCommissions.orderId, orderId),
      inArray(affiliateCommissions.status, ['approved', 'paid']),
    ));

  for (const row of rows) {
    await db.insert(affiliateCommissions).values({
      affiliateId: row.affiliateId,
      orderId: row.orderId,
      orderItemId: row.orderItemId,
      entryType: 'reversal',
      baseAmount: row.baseAmount,
      ratePercent: row.ratePercent,
      amount: String(-Math.abs(Number(row.amount))),
      ruleId: row.ruleId,
      status: 'approved', // reversal langsung approved — efeknya harus segera mengurangi saldo
      rejectReason: reason.slice(0, 255),
    });
  }
}
