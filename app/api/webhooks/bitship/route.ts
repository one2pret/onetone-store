// app/api/webhooks/bitship/route.ts — Bitship tracking webhook
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shippings, shippingHistories, orders, orderStatusLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { restoreStock } from '@/lib/stock';

// Bitship statuses that map to order transitions
const DELIVERED_STATUSES = ['delivered'];
const CANCELLED_STATUSES = ['cancelled', 'returned', 'rejected'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const trackingId = body.order_id; // Bitship uses order_id as their tracking reference
    const status = body.status;

    if (!trackingId || !status) {
      return NextResponse.json({ success: true, message: 'Ignored: missing data' });
    }

    // Find shipping by trackingId
    const shippingRows = await db.select().from(shippings)
      .where(eq(shippings.trackingId, trackingId))
      .limit(1);

    if (shippingRows.length === 0) {
      return NextResponse.json({ success: true, message: 'Ignored: unknown tracking' });
    }

    const shipping = shippingRows[0];

    // Update shipping status
    await db.update(shippings)
      .set({ status })
      .where(eq(shippings.id, shipping.id));

    // Insert shipping history
    await db.insert(shippingHistories).values({
      shippingId: shipping.id,
      status,
      note: body.courier_tracking_id ? `Waybill: ${body.courier_tracking_id}` : null,
    });

    // Get order for status transition
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, shipping.orderId))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ success: true });
    }

    const order = orderRows[0];

    // Handle delivered
    if (DELIVERED_STATUSES.includes(status) && order.status !== 'delivered') {
      await db.update(orders)
        .set({ status: 'delivered', deliveredAt: new Date() })
        .where(eq(orders.id, order.id));

      await db.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: order.status!,
        toStatus: 'delivered',
        changedBy: 'webhook:bitship',
      });
    }

    // Handle cancelled/returned/rejected
    if (CANCELLED_STATUSES.includes(status) && order.status !== 'cancelled') {
      await db.update(orders)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(orders.id, order.id));

      await restoreStock(order.id);

      await db.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: order.status!,
        toStatus: 'cancelled',
        changedBy: 'webhook:bitship',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bitship webhook error:', error);
    return NextResponse.json({ success: true, message: 'Error handled' });
  }
}
