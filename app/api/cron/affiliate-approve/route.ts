// app/api/cron/affiliate-approve/route.ts — jalan tiap jam
// Komisi holding yang holdUntil sudah lewat -> approved (masuk saldo bisa ditarik).
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { affiliateCommissions } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const eligible = await db.select({ id: affiliateCommissions.id }).from(affiliateCommissions)
      .where(and(
        eq(affiliateCommissions.status, 'holding'),
        sql`${affiliateCommissions.holdUntil} < NOW()`,
      ));

    if (eligible.length > 0) {
      await db.update(affiliateCommissions)
        .set({ status: 'approved', approvedAt: sql`NOW()` })
        .where(and(
          eq(affiliateCommissions.status, 'holding'),
          sql`${affiliateCommissions.holdUntil} < NOW()`,
        ));
    }

    return NextResponse.json({ success: true, approved: eligible.length });
  } catch (error) {
    console.error('Cron affiliate-approve error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
