// app/api/orders/[id]/tracking/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, shippings, shippingHistories, sandboxBookings } from '@/lib/db/schema';
import { canViewSandboxBooking, sandboxBookingSummary } from '@/lib/checkout/sandbox-booking-summary';
import { eq, desc } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';

// GET /api/orders/[id]/tracking — get shipping & tracking info
export async function GET(
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

    if (orderRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Order tidak ditemukan' }, { status: 404 });
    }

    const order = orderRows[0];

    // Ownership check (admin can see all)
    if (user.role !== 'admin' && order.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Read-only TEST summary is available even when the booking POST gate is OFF.
    // Ownership has already been checked; do not fetch snapshot/PII.
    const sandboxBooking = canViewSandboxBooking(order.orderNumber)
      ? sandboxBookingSummary((await db.select({
          mode: sandboxBookings.mode,
          status: sandboxBookings.status,
          waybillId: sandboxBookings.waybillId,
        }).from(sandboxBookings).where(eq(sandboxBookings.orderId, orderId)).limit(1))[0])
      : null;

    // Get shipping
    const shippingRows = await db.select().from(shippings)
      .where(eq(shippings.orderId, orderId))
      .limit(1);

    if (shippingRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { shipping: null, histories: [], sandboxBooking },
      });
    }

    const shipping = shippingRows[0];

    // Get histories
    const histories = await db.select().from(shippingHistories)
      .where(eq(shippingHistories.shippingId, shipping.id))
      .orderBy(desc(shippingHistories.updatedAt));

    return NextResponse.json({
      success: true,
      data: { shipping, histories, sandboxBooking },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data tracking' },
      { status: 500 },
    );
  }
}
