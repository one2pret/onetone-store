// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  orders, orderItems, invoices, shippings, addresses,
  cartItems, products, users,
} from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';
import { generateOrderNumber } from '@/lib/utils';
import { validateStock, deductStock } from '@/lib/stock';
import { createInvoice } from '@/lib/xendit';
import { z } from 'zod';

// GET /api/orders — user's orders with invoice & shipping info
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orderRows = await db.select()
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt));

    if (orderRows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const orderIds = orderRows.map(o => o.id);

    // Fetch items, invoices, and shippings in parallel
    const [allItems, allInvoices, allShippings] = await Promise.all([
      db.select().from(orderItems).where(
        sql`${orderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`
      ),
      db.select().from(invoices).where(
        sql`${invoices.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`
      ),
      db.select().from(shippings).where(
        sql`${shippings.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`
      ),
    ]);

    const result = orderRows.map(order => ({
      ...order,
      items: allItems.filter(item => item.orderId === order.id),
      invoice: allInvoices.find(inv => inv.orderId === order.id && inv.status !== 'cancelled') ?? null,
      shipping: allShippings.find(s => s.orderId === order.id) ?? null,
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data pesanan' },
      { status: 500 },
    );
  }
}

const createOrderSchema = z.object({
  addressId: z.number({ required_error: 'addressId wajib diisi' }),
  courierName: z.string().min(1, 'courierName wajib diisi'),
  courierCompany: z.string().min(1, 'courierCompany wajib diisi'),
  courierType: z.string().min(1, 'courierType wajib diisi'),
  courierPrice: z.number().min(0),
  notes: z.string().optional().nullable(),
});

// POST /api/orders — create order from cart
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = createOrderSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validasi gagal', errors: validated.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { addressId, courierName, courierCompany, courierType, courierPrice, notes } = validated.data;

    // 1. Validate address ownership
    const addressRows = await db.select().from(addresses)
      .where(eq(addresses.id, addressId))
      .limit(1);

    if (addressRows.length === 0 || addressRows[0].userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Alamat tidak ditemukan atau bukan milik Anda' },
        { status: 400 },
      );
    }
    const address = addressRows[0];

    // 2. Get cart items
    const cart = await db.select()
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, user.id));

    if (cart.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Keranjang kosong' },
        { status: 400 },
      );
    }

    // 3. Validate stock
    const stockItems = cart.map(row => ({
      productId: row.cart_items.productId,
      quantity: row.cart_items.quantity ?? 1,
      productName: row.products!.name,
    }));

    const stockResult = await validateStock(stockItems);
    if (!stockResult.valid) {
      return NextResponse.json(
        { success: false, error: stockResult.errors.join(', ') },
        { status: 400 },
      );
    }

    // 4. Calculate totals
    const subtotal = cart.reduce((sum, row) => {
      return sum + (Number(row.products!.price) * (row.cart_items.quantity ?? 1));
    }, 0);

    const total = subtotal + courierPrice;
    const orderNumber = generateOrderNumber();

    // 5. Create order
    const [result] = await db.insert(orders).values({
      userId: user.id,
      orderNumber,
      status: 'waiting_payment',
      subtotal: String(subtotal),
      shippingCost: String(courierPrice),
      total: String(total),
      willExpiredAt: sql`NOW() + INTERVAL 24 HOUR`,
      shippingName: address.recipientName,
      shippingPhone: address.phone,
      shippingAddress: address.address,
      notes: notes || null,
    });

    const orderId = Number(result.insertId);

    // 6. Create order items
    await db.insert(orderItems).values(
      cart.map((row) => ({
        orderId,
        productId: row.cart_items.productId,
        productName: row.products!.name,
        productImage: row.products!.image,
        price: row.products!.price,
        quantity: row.cart_items.quantity ?? 1,
        subtotal: String(Number(row.products!.price) * (row.cart_items.quantity ?? 1)),
      })),
    );

    // 7. Create shipping record
    await db.insert(shippings).values({
      orderId,
      recipientName: address.recipientName,
      phone: address.phone,
      address: address.address,
      addressDetail: address.detail,
      latitude: address.latitude,
      longitude: address.longitude,
      courierName,
      courierCompany,
      courierType,
      price: String(courierPrice),
    });

    // 8. Deduct stock
    await deductStock(
      cart.map(row => ({
        productId: row.cart_items.productId,
        quantity: row.cart_items.quantity ?? 1,
      })),
    );

    // 9. Clear cart
    await db.delete(cartItems).where(eq(cartItems.userId, user.id));

    // 10. Create Xendit invoice
    let paymentUrl: string | undefined;
    try {
      const invoice = await createInvoice({
        externalId: orderNumber,
        amount: total,
        payerEmail: user.email,
        description: `Pembayaran order ${orderNumber}`,
        orderId,
      });

      paymentUrl = invoice.invoiceUrl;

      await db.insert(invoices).values({
        orderId,
        xenditId: invoice.id,
        invoiceUrl: invoice.invoiceUrl,
        amount: String(total),
        status: 'pending',
        expiredAt: new Date(invoice.expiryDate),
      });
    } catch (xenditError) {
      console.error('Xendit invoice creation failed:', xenditError);
    }

    // Fetch created order
    const createdOrder = await db.select().from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        ...createdOrder[0],
        paymentUrl,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal membuat order' },
      { status: 500 },
    );
  }
}
