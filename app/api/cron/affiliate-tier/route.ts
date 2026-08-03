// app/api/cron/affiliate-tier/route.ts — jalan harian, jam 02:00 WIB
// Hitung GMV 30 hari per affiliate -> naik/turunkan tier.
// Threshold sama seperti §2.2 plan: Pro >= Rp5jt, Elite >= Rp15jt (30 hari terakhir).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { affiliates, orders } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const TIER_THRESHOLDS = [
  { tier: 'elite' as const, minGmv: 15_000_000 },
  { tier: 'pro' as const, minGmv: 5_000_000 },
  { tier: 'starter' as const, minGmv: 0 },
];

function resolveTier(gmv: number): 'starter' | 'pro' | 'elite' {
  return TIER_THRESHOLDS.find((t) => gmv >= t.minGmv)!.tier;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activeAffiliates = await db.select({ id: affiliates.id, tier: affiliates.tier })
      .from(affiliates)
      .where(eq(affiliates.status, 'active'));

    let changed = 0;

    for (const affiliate of activeAffiliates) {
      const [gmvRow] = await db.select({
        gmv: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
      }).from(orders).where(sql`
        ${orders.affiliateId} = ${affiliate.id}
        AND ${orders.status} != 'cancelled'
        AND ${orders.status} != 'expired'
        AND ${orders.createdAt} >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);

      const gmv = Number(gmvRow?.gmv ?? 0);
      const newTier = resolveTier(gmv);

      if (newTier !== affiliate.tier) {
        await db.update(affiliates).set({ tier: newTier }).where(eq(affiliates.id, affiliate.id));
        changed++;
      }
    }

    return NextResponse.json({ success: true, checked: activeAffiliates.length, changed });
  } catch (error) {
    console.error('Cron affiliate-tier error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
