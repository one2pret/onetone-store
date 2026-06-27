// app/api/orders/[id]/cancel/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, invoices, orderStatusLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';
import { restoreStock } from '@/lib/stock';
import { expireInvoice } from '@/lib/xendit';

// POST /api/orders/[id]/cancel — cancel order by customer
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const orderId = Number(id);

    // Get order
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderRows.length === 0 || orderRows[0].userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const order = orderRows[0];

    if (order.status !== 'waiting_payment') {
      return NextResponse.json(
        { success: false, error: 'Hanya order berstatus menunggu pembayaran yang dapat dibatalkan' },
        { status: 400 },
      );
    }

    // Try to expire Xendit invoice
    const invoiceRows = await db.select().from(invoices)
      .where(eq(invoices.orderId, orderId))
      .limit(1);

    if (invoiceRows.length > 0 && invoiceRows[0].xenditId) {
      try {
        await expireInvoice(invoiceRows[0].xenditId);
      } catch {
        // Continue
      }
      await db.update(invoices)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(invoices.id, invoiceRows[0].id));
    }

    // Restore stock
    await restoreStock(orderId);

    // Update order
    await db.update(orders)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(orders.id, orderId));

    // Audit log
    await db.insert(orderStatusLogs).values({
      orderId,
      fromStatus: 'waiting_payment',
      toStatus: 'cancelled',
      changedBy: `user:${user.id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal membatalkan order' },
      { status: 500 },
    );
  }
}
