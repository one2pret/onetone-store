// app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, invoices, shippings, shippingHistories } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';

// GET /api/orders/[id] — full order detail with items, invoice, shipping, tracking
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

    const orderRows = await db.select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const order = orderRows[0];

    // Ownership check (admin can see all)
    if (user.role !== 'admin' && order.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch related data in parallel
    const [items, invoiceRows, shippingRows] = await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
      db.select().from(invoices).where(eq(invoices.orderId, orderId)),
      db.select().from(shippings).where(eq(shippings.orderId, orderId)).limit(1),
    ]);

    // Get active invoice (latest non-cancelled)
    const activeInvoice = invoiceRows.find(inv => inv.status !== 'cancelled') ?? null;

    // Get tracking histories if shipping exists
    const shipping = shippingRows[0] ?? null;
    let trackingHistories: any[] = [];
    if (shipping) {
      trackingHistories = await db.select().from(shippingHistories)
        .where(eq(shippingHistories.shippingId, shipping.id))
        .orderBy(desc(shippingHistories.updatedAt));
    }

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        items,
        invoice: activeInvoice,
        shipping,
        trackingHistories,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data pesanan' },
      { status: 500 },
    );
  }
}
