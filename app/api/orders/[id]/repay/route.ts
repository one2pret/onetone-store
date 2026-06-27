// app/api/orders/[id]/repay/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, invoices, orderStatusLogs } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';
import { validateStock, deductStock } from '@/lib/stock';
import { createInvoice } from '@/lib/xendit';

// POST /api/orders/[id]/repay — repay expired order or retry failed payment
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
    const isExpired = order.status === 'expired';
    const isWaitingNoInvoice = order.status === 'waiting_payment';

    if (!isExpired && !isWaitingNoInvoice) {
      return NextResponse.json(
        { success: false, error: 'Order tidak dapat dibayar' },
        { status: 400 },
      );
    }

    // For waiting_payment, check if active invoice exists
    if (isWaitingNoInvoice) {
      const existingInvoice = await db.select().from(invoices)
        .where(eq(invoices.orderId, orderId))
        .limit(1);
      if (existingInvoice.length > 0 && existingInvoice[0].invoiceUrl) {
        return NextResponse.json({
          success: true,
          data: { paymentUrl: existingInvoice[0].invoiceUrl },
        });
      }
    }

    // Get order items for stock validation
    const items = await db.select().from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const stockItems = items.map(item => ({
      productId: item.productId!,
      quantity: item.quantity,
      productName: item.productName,
    }));

    // Validate stock
    const stockResult = await validateStock(stockItems);
    if (!stockResult.valid) {
      return NextResponse.json(
        { success: false, error: stockResult.errors.join(', ') },
        { status: 400 },
      );
    }

    // Create new Xendit invoice
    const invoice = await createInvoice({
      externalId: order.orderNumber!,
      amount: Number(order.total),
      payerEmail: user.email,
      description: `Pembayaran order ${order.orderNumber}`,
      orderId,
    });

    // Store new invoice
    await db.insert(invoices).values({
      orderId,
      xenditId: invoice.id,
      invoiceUrl: invoice.invoiceUrl,
      amount: order.total!,
      status: 'pending',
      expiredAt: new Date(invoice.expiryDate),
    });

    if (isExpired) {
      // Transition back to waiting_payment
      await db.update(orders).set({
        status: 'waiting_payment',
        willExpiredAt: sql`NOW() + INTERVAL 24 HOUR`,
        expiredAt: null,
      }).where(eq(orders.id, orderId));

      // Deduct stock again
      await deductStock(stockItems.map(i => ({ productId: i.productId, quantity: i.quantity })));

      // Audit log
      await db.insert(orderStatusLogs).values({
        orderId,
        fromStatus: 'expired',
        toStatus: 'waiting_payment',
        changedBy: `user:${user.id}`,
        note: 'Pembayaran ulang via API',
      });
    }

    return NextResponse.json({
      success: true,
      data: { paymentUrl: invoice.invoiceUrl },
    });
  } catch (error) {
    console.error('Repay order error:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal membuat pembayaran ulang' },
      { status: 500 },
    );
  }
}
