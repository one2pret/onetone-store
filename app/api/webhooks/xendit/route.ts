// app/api/webhooks/xendit/route.ts — Xendit payment webhook
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, orders, orderStatusLogs } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { restoreStock } from '@/lib/stock';

export async function POST(request: Request) {
  // Verify callback token
  const callbackToken = request.headers.get('x-callback-token');
  const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN;

  if (!callbackToken || callbackToken !== expectedToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id: xenditId, status, payment_method, payment_channel, paid_at } = body;

    if (!xenditId || !status) {
      return NextResponse.json({ success: true, message: 'Ignored: missing data' });
    }

    // Find invoice by xenditId
    const invRows = await db.select().from(invoices)
      .where(eq(invoices.xenditId, xenditId))
      .limit(1);

    if (invRows.length === 0) {
      return NextResponse.json({ success: true, message: 'Ignored: unknown invoice' });
    }

    const invoice = invRows[0];

    // Get order
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, invoice.orderId))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ success: true, message: 'Ignored: order not found' });
    }

    const order = orderRows[0];

    if (status === 'PAID') {
      // Idempotent: skip if already paid
      if (invoice.status === 'paid') {
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // Update invoice
      await db.update(invoices).set({
        status: 'paid',
        paymentMethod: payment_method,
        paymentChannel: payment_channel,
        paidAt: sql`NOW()`,
      }).where(eq(invoices.id, invoice.id));

      // Transition order to packing
      await db.update(orders).set({
        status: 'packing',
        paidAt: sql`NOW()`,
      }).where(eq(orders.id, order.id));

      // Audit log
      await db.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: order.status!,
        toStatus: 'packing',
        changedBy: 'webhook:xendit',
      });
    }

    if (status === 'EXPIRED') {
      // Idempotent: skip if already expired
      if (invoice.status === 'expired') {
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // Update invoice
      await db.update(invoices).set({
        status: 'expired',
      }).where(eq(invoices.id, invoice.id));

      // Transition order to expired
      await db.update(orders).set({
        status: 'expired',
        expiredAt: sql`NOW()`,
      }).where(eq(orders.id, order.id));

      // Restore stock
      await restoreStock(order.id);

      // Audit log
      await db.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: order.status!,
        toStatus: 'expired',
        changedBy: 'webhook:xendit',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Xendit webhook error:', error);
    return NextResponse.json({ success: true, message: 'Error handled' });
  }
}
