// app/api/cron/check-expired-orders/route.ts — Safety net for missed Xendit webhooks
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, invoices, orderStatusLogs } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { restoreStock } from '@/lib/stock';
import { expireInvoice } from '@/lib/xendit';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find expired orders
    const expiredOrders = await db.select().from(orders)
      .where(
        and(
          eq(orders.status, 'waiting_payment'),
          sql`${orders.willExpiredAt} < NOW()`,
        ),
      );

    let count = 0;

    for (const order of expiredOrders) {
      // Try to expire Xendit invoice
      const invoiceRows = await db.select().from(invoices)
        .where(eq(invoices.orderId, order.id))
        .limit(1);

      if (invoiceRows.length > 0 && invoiceRows[0].xenditId) {
        try {
          await expireInvoice(invoiceRows[0].xenditId);
        } catch {
          // Continue even if Xendit expire fails
        }

        await db.update(invoices).set({ status: 'expired' })
          .where(eq(invoices.id, invoiceRows[0].id));
      }

      // Transition order to expired
      await db.update(orders).set({
        status: 'expired',
        expiredAt: new Date(),
      }).where(eq(orders.id, order.id));

      // Restore stock
      await restoreStock(order.id);

      // Audit log
      await db.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: 'waiting_payment',
        toStatus: 'expired',
        changedBy: 'cron:system',
      });

      count++;
    }

    return NextResponse.json({ success: true, expired: count });
  } catch (error) {
    console.error('Cron expired orders error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
