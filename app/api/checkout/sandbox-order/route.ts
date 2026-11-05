import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, invoices } from '@/lib/db/schema';
import { getApiUser } from '@/lib/api-auth';
import { createInvoice } from '@/lib/xendit';
import { createInternalCustomerEmail } from '@/lib/registration-utils';
import { loadTrustedCheckoutSelection } from '@/lib/checkout/fresh-quote-service';
import { commitSandboxOrder, CheckoutRejected } from '@/lib/checkout/commit-sandbox-order';
import { sandboxOrderEnabled, sandboxOrderNumber } from '@/lib/checkout/sandbox-order-policy';

const schema = z.object({
  addressId: z.number().int().positive(),
  courierCompany: z.string().trim().min(1).max(64),
  courierType: z.string().trim().min(1).max(64),
  courierPrice: z.number().int().nonnegative(),
  notes: z.string().max(2000).optional().nullable(),
});

async function currentPayment(orderNumber: string, userId: number) {
  const [order] = await db.select().from(orders)
    .where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order || order.userId !== userId) return null;
  const [invoice] = await db.select().from(invoices)
    .where(eq(invoices.orderId, order.id)).orderBy(desc(invoices.createdAt)).limit(1);
  if (!invoice?.invoiceUrl) {
    // An invoice attempt could have succeeded remotely but failed locally.
    // Never automatically repeat the Xendit call for this order number.
    return NextResponse.json({
      success: false, code: 'payment_setup_pending',
      error: 'Order sudah dicatat. Pembayaran perlu rekonsiliasi; jangan membuat ulang pesanan.',
      data: { orderId: order.id, orderNumber },
    }, { status: 202 });
  }
  return NextResponse.json({
    success: true,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      shippingCost: Number(order.shippingCost),
      paymentUrl: invoice.invoiceUrl,
      repeatedRequest: true,
    },
  });
}

/**
 * New staging-only checkout endpoint (old web POST /api/orders remains intact).
 * Sends to Xendit only after the MySQL transaction commits.
 */
export async function POST(request: Request) {
  // Double-gate: an explicit flag and a DEVELOPMENT Xendit key.
  if (!sandboxOrderEnabled(process.env.CHECKOUT_SANDBOX_ORDER_ENABLED, process.env.XENDIT_SECRET_KEY)) {
    return NextResponse.json({ success: false, error: 'Not available' }, { status: 404 });
  }
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const key = request.headers.get('idempotency-key');
  if (!key || !z.string().uuid().safeParse(key).success) {
    return NextResponse.json({
      success: false, error: 'Header Idempotency-Key (UUID) wajib diisi',
    }, { status: 400 });
  }
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'JSON tidak valid' }, { status: 400 }); }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Data checkout tidak valid' }, { status: 400 });
  }

  const orderNumber = sandboxOrderNumber(user.id, key);
  try {
    // Safe retry: don't call Biteship or Xendit again for the same key.
    const prior = await currentPayment(orderNumber, user.id);
    if (prior) return prior;

    const { addressId, notes, ...selection } = parsed.data;
    const quote = await loadTrustedCheckoutSelection(user.id, addressId, selection);
    if (!quote.ok) {
      const status = quote.reason === 'address' ? 404
        : quote.reason === 'rate_changed' ? 409
        : quote.reason === 'cart' || quote.reason === 'invalid_weight_or_coordinates' ? 422
        : 503;
      return NextResponse.json({
        success: false, code: quote.reason,
        error: quote.reason === 'rate_changed' ? 'Tarif berubah. Perbarui kurir.'
          : 'Alamat, keranjang atau tarif pengiriman belum valid.',
      }, { status });
    }

    const committed = await commitSandboxOrder({
      userId: user.id, addressId, notes, orderNumber, snapshot: quote.snapshot,
      shipping: {
        courierName: quote.selected.courierName,
        courierCompany: quote.selected.courierCompany,
        courierType: quote.selected.courierType,
        price: quote.selected.price,
      },
    });
    if (!committed.created) {
      const retry = await currentPayment(orderNumber, user.id);
      if (retry) return retry;
    }

    // Remote call OUTSIDE DB transaction. We never automatically replay after
    // a timeout, to avoid creating duplicate invoices.
    try {
      const payment = await createInvoice({
        externalId: committed.orderNumber,
        amount: committed.total,
        payerEmail: user.email ?? createInternalCustomerEmail(user.phone ?? String(user.id)),
        description: 'Pembayaran staging order ' + committed.orderNumber,
        orderId: committed.orderId,
      });
      await db.insert(invoices).values({
        orderId: committed.orderId,
        xenditId: payment.id,
        invoiceUrl: payment.invoiceUrl,
        amount: String(committed.total),
        status: 'pending',
        expiredAt: new Date(payment.expiryDate),
      });
      return NextResponse.json({
        success: true,
        data: {
          orderId: committed.orderId,
          orderNumber: committed.orderNumber,
          status: 'waiting_payment',
          total: committed.total,
          shippingCost: quote.selected.price,
          paymentUrl: payment.invoiceUrl,
        },
      }, { status: 201 });
    } catch (error) {
      console.error('Staging invoice setup requires reconciliation', error);
      return NextResponse.json({
        success: false, code: 'payment_setup_pending',
        error: 'Order tercatat tetapi pembayaran belum terkonfirmasi. Hubungi admin; jangan ulangi pesanan dengan kunci baru.',
        data: { orderId: committed.orderId, orderNumber: committed.orderNumber },
      }, { status: 202 });
    }
  } catch (error) {
    if (error instanceof CheckoutRejected) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Staging sandbox checkout failed', error);
    return NextResponse.json({
      success: false, error: 'Checkout tidak dapat diproses',
    }, { status: 503 });
  }
}
