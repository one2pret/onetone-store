// app/actions/orders.ts
'use server';

import { db } from '@/lib/db';
import {
  orders, orderItems, cartItems, products, productVariants, users,
  orderStatusLogs, addresses, shippings, shippingHistories, invoices,
} from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { generateOrderNumber } from '@/lib/utils';
import { validateStatusTransition } from '@/lib/order-status';
import { deductStock, restoreStock, validateStock } from '@/lib/stock';
import { createInvoice, expireInvoice } from '@/lib/xendit';

// Helper: get orders with items
async function queryOrdersWithItems(orderRows: any[]) {
  if (orderRows.length === 0) return [];
  const orderIds = orderRows.map(o => o.id);
  const allItems = await db.select().from(orderItems).where(
    sql`${orderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`
  );
  return orderRows.map(order => ({
    ...order,
    items: allItems.filter(item => item.orderId === order.id),
  }));
}

// Create order from cart
export async function createOrder(prevState: any, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const userId = Number(session.user.id);
  const addressId = Number(formData.get('addressId'));
  const courierName = formData.get('courierName') as string || '';
  const courierCompany = formData.get('courierCompany') as string || '';
  const courierType = formData.get('courierType') as string || '';
  const courierPrice = Number(formData.get('courierPrice') || 0);
  const notes = (formData.get('notes') as string) || '';

  try {
    // 1. Validate address
    const addressRows = await db.select().from(addresses)
      .where(eq(addresses.id, addressId)).limit(1);
    if (addressRows.length === 0 || addressRows[0].userId !== userId) {
      return { success: false, error: 'Alamat tidak ditemukan atau bukan milik Anda' };
    }
    const address = addressRows[0];

    // 2. Get cart items with product + variant info
    const cartRows = await db.select()
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .where(eq(cartItems.userId, userId));

    if (cartRows.length === 0) {
      return { success: false, error: 'Keranjang kosong' };
    }

    // 3. Validate stock (per variant jika ada, fallback ke produk)
    const stockItems = cartRows.map(row => ({
      productId: row.cart_items.productId,
      variantId: row.cart_items.variantId ?? undefined,
      quantity: row.cart_items.quantity ?? 1,
      productName: row.products!.name +
        (row.product_variants ? ` (${row.product_variants.size} / ${row.product_variants.color})` : ''),
    }));

    const stockResult = await validateStock(stockItems);
    if (!stockResult.valid) {
      return { success: false, error: stockResult.errors.join(', ') };
    }

    // 4. Calculate subtotal — harga dasar + priceModifier varian
    const subtotal = cartRows.reduce((sum, row) => {
      const base = Number(row.products!.price);
      const modifier = Number(row.product_variants?.priceModifier ?? 0);
      return sum + (base + modifier) * (row.cart_items.quantity ?? 1);
    }, 0);

    const total = subtotal + courierPrice;
    const orderNumber = generateOrderNumber();

    // 5. Create order
    const [result] = await db.insert(orders).values({
      userId,
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

    // 6. Create order items — simpan variantId + variantLabel (snapshot)
    await db.insert(orderItems).values(
      cartRows.map((row) => {
        const base = Number(row.products!.price);
        const modifier = Number(row.product_variants?.priceModifier ?? 0);
        const unitPrice = base + modifier;
        const qty = row.cart_items.quantity ?? 1;
        const variant = row.product_variants;
        const variantLabel = variant ? `${variant.size} / ${variant.color}` : null;

        return {
          orderId,
          productId: row.cart_items.productId,
          variantId: row.cart_items.variantId ?? null,
          productName: row.products!.name,
          productImage: row.products!.image,
          variantLabel,
          price: String(unitPrice),
          quantity: qty,
          subtotal: String(unitPrice * qty),
        };
      })
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

    // 8. Deduct stock (variant atau produk)
    await deductStock(
      cartRows.map(row => ({
        productId: row.cart_items.productId,
        variantId: row.cart_items.variantId ?? undefined,
        quantity: row.cart_items.quantity ?? 1,
      }))
    );

    // 9. Clear cart
    await db.delete(cartItems).where(eq(cartItems.userId, userId));

    // 10. Create Xendit invoice
    let paymentUrl: string | undefined;
    try {
      const userRows = await db.select().from(users)
        .where(eq(users.id, userId)).limit(1);
      const userEmail = userRows[0]?.email || '';

      const invoice = await createInvoice({
        externalId: orderNumber,
        amount: total,
        payerEmail: userEmail,
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

    revalidatePath('/orders');
    revalidatePath('/cart');

    return { success: true, orderId, paymentUrl };
  } catch (error) {
    console.error('Create order error:', error);
    return { success: false, error: 'Gagal membuat order' };
  }
}

// Cancel order by customer
export async function cancelOrderByCustomer(orderId: number) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const userId = Number(session.user.id);

  try {
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, orderId)).limit(1);

    if (orderRows.length === 0 || orderRows[0].userId !== userId) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const order = orderRows[0];

    if (order.status !== 'waiting_payment') {
      return { success: false, error: 'Hanya order berstatus waiting_payment yang dapat dibatalkan' };
    }

    const invoiceRows = await db.select().from(invoices)
      .where(eq(invoices.orderId, orderId)).limit(1);

    if (invoiceRows.length > 0 && invoiceRows[0].xenditId) {
      try { await expireInvoice(invoiceRows[0].xenditId); } catch { /* continue */ }
      await db.update(invoices).set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(invoices.id, invoiceRows[0].id));
    }

    await restoreStock(orderId);

    await db.update(orders).set({
      status: 'cancelled',
      cancelledAt: new Date(),
    }).where(eq(orders.id, orderId));

    await db.insert(orderStatusLogs).values({
      orderId,
      fromStatus: 'waiting_payment',
      toStatus: 'cancelled',
      changedBy: `user:${userId}`,
    });

    revalidatePath('/orders');
    revalidatePath('/dashboard/orders');
    return { success: true };
  } catch (error) {
    console.error('Cancel order error:', error);
    return { success: false, error: 'Gagal membatalkan order' };
  }
}

// Repay expired order
export async function repayOrder(orderId: number): Promise<{
  success: boolean;
  error?: string;
  paymentUrl?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const userId = Number(session.user.id);

  try {
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, orderId)).limit(1);

    if (orderRows.length === 0 || orderRows[0].userId !== userId) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const order = orderRows[0];
    const isExpired = order.status === 'expired';
    const isWaitingNoInvoice = order.status === 'waiting_payment';

    if (!isExpired && !isWaitingNoInvoice) {
      return { success: false, error: 'Order tidak dapat dibayar' };
    }

    if (isWaitingNoInvoice) {
      const existingInvoice = await db.select().from(invoices)
        .where(eq(invoices.orderId, orderId)).limit(1);
      if (existingInvoice.length > 0 && existingInvoice[0].invoiceUrl) {
        return { success: true, paymentUrl: existingInvoice[0].invoiceUrl };
      }
    }

    const items = await db.select().from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const stockItems = items.map(item => ({
      productId: item.productId!,
      variantId: item.variantId ?? undefined,
      quantity: item.quantity,
      productName: item.productName,
    }));

    const userRows = await db.select().from(users)
      .where(eq(users.id, userId)).limit(1);
    const userEmail = userRows[0]?.email || '';

    const stockResult = await validateStock(stockItems);
    if (!stockResult.valid) {
      return { success: false, error: stockResult.errors.join(', ') };
    }

    const invoice = await createInvoice({
      externalId: order.orderNumber!,
      amount: Number(order.total),
      payerEmail: userEmail,
      description: `Pembayaran order ${order.orderNumber}`,
      orderId,
    });

    await db.insert(invoices).values({
      orderId,
      xenditId: invoice.id,
      invoiceUrl: invoice.invoiceUrl,
      amount: order.total!,
      status: 'pending',
      expiredAt: new Date(invoice.expiryDate),
    });

    if (isExpired) {
      await db.update(orders).set({
        status: 'waiting_payment',
        willExpiredAt: sql`NOW() + INTERVAL 24 HOUR`,
        expiredAt: null,
      }).where(eq(orders.id, orderId));

      await deductStock(stockItems.map(i => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })));

      await db.insert(orderStatusLogs).values({
        orderId,
        fromStatus: 'expired',
        toStatus: 'waiting_payment',
        changedBy: `user:${userId}`,
        note: 'Pembayaran ulang',
      });
    }

    revalidatePath('/orders');
    return { success: true, paymentUrl: invoice.invoiceUrl };
  } catch (error) {
    console.error('Repay order error:', error);
    return { success: false, error: 'Gagal membuat pembayaran ulang' };
  }
}

// Cancel order by admin
export async function cancelOrderByAdmin(orderId: number) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return { success: false, error: 'Hanya admin yang dapat membatalkan order' };
  }

  const adminId = session.user.id;

  try {
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, orderId)).limit(1);

    if (orderRows.length === 0) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const order = orderRows[0];
    const allowedStatuses = ['waiting_payment', 'packing'];

    if (!allowedStatuses.includes(order.status!)) {
      return { success: false, error: `Order berstatus "${order.status}" tidak dapat dibatalkan oleh admin` };
    }

    if (order.status === 'waiting_payment') {
      const invoiceRows = await db.select().from(invoices)
        .where(eq(invoices.orderId, orderId)).limit(1);
      if (invoiceRows.length > 0 && invoiceRows[0].xenditId) {
        try { await expireInvoice(invoiceRows[0].xenditId); } catch { /* continue */ }
        await db.update(invoices).set({ status: 'cancelled', cancelledAt: new Date() })
          .where(eq(invoices.id, invoiceRows[0].id));
      }
    }

    await restoreStock(orderId);

    await db.update(orders).set({
      status: 'cancelled',
      cancelledAt: new Date(),
    }).where(eq(orders.id, orderId));

    await db.insert(orderStatusLogs).values({
      orderId,
      fromStatus: order.status!,
      toStatus: 'cancelled',
      changedBy: `admin:${adminId}`,
    });

    revalidatePath('/orders');
    revalidatePath('/dashboard/orders');
    return { success: true };
  } catch (error) {
    console.error('Admin cancel order error:', error);
    return { success: false, error: 'Gagal membatalkan order' };
  }
}

// Get order tracking info
export async function getOrderTracking(orderId: number): Promise<{
  success: boolean;
  error?: string;
  data?: { shipping: any | null; histories: any[] };
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const userId = Number(session.user.id);
  const isAdmin = (session.user as any).role === 'admin';

  try {
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, orderId)).limit(1);

    if (orderRows.length === 0) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const order = orderRows[0];
    if (!isAdmin && order.userId !== userId) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const shippingRows = await db.select().from(shippings)
      .where(eq(shippings.orderId, orderId)).limit(1);

    if (shippingRows.length === 0) {
      return { success: true, data: { shipping: null, histories: [] } };
    }

    const shipping = shippingRows[0];
    const histories = await db.select().from(shippingHistories)
      .where(eq(shippingHistories.shippingId, shipping.id))
      .orderBy(desc(shippingHistories.updatedAt));

    return { success: true, data: { shipping, histories } };
  } catch (error) {
    console.error('Get order tracking error:', error);
    return { success: false, error: 'Gagal mengambil data tracking' };
  }
}

// Get user's orders
export async function getUserOrders() {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = Number(session.user.id);
  const orderRows = await db.select().from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
  return queryOrdersWithItems(orderRows);
}

// Get single order
export async function getOrder(id: number) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const rows = await db.select()
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (rows.length === 0) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

  return {
    ...rows[0].orders,
    items,
    user: rows[0].users,
  };
}

// Get all orders (admin)
export async function getAllOrders() {
  const rows = await db.select()
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.createdAt));

  const orderIds = rows.map(r => r.orders.id);
  let allItems: any[] = [];
  if (orderIds.length > 0) {
    allItems = await db.select().from(orderItems).where(
      sql`${orderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`
    );
  }

  return rows.map(row => ({
    ...row.orders,
    items: allItems.filter(item => item.orderId === row.orders.id),
    user: row.users,
  }));
}

// Update order status (admin legacy)
export async function updateOrderStatus(orderId: number, status: string) {
  try {
    await db.update(orders).set({ status: status as any }).where(eq(orders.id, orderId));
    revalidatePath('/dashboard/orders');
    revalidatePath('/orders');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal update status' };
  }
}

// Change order status with validation and audit log
export async function changeOrderStatus(
  orderId: number,
  newStatus: string,
  changedBy: string,
  note?: string,
) {
  try {
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (orderRows.length === 0) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const order = orderRows[0];
    const currentStatus = order.status!;

    if (!validateStatusTransition(currentStatus, newStatus)) {
      return {
        success: false,
        error: `Transisi status dari "${currentStatus}" ke "${newStatus}" tidak valid`,
      };
    }

    const updateData: Record<string, any> = { status: newStatus as any };
    switch (newStatus) {
      case 'packing':   updateData.paidAt = sql`NOW()`; break;
      case 'shipping':  updateData.shippingAt = sql`NOW()`; break;
      case 'delivered': updateData.deliveredAt = sql`NOW()`; break;
      case 'expired':   updateData.expiredAt = sql`NOW()`; break;
      case 'cancelled': updateData.cancelledAt = sql`NOW()`; break;
    }

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    await db.insert(orderStatusLogs).values({
      orderId,
      fromStatus: currentStatus,
      toStatus: newStatus,
      changedBy,
      note: note || null,
    });

    revalidatePath('/dashboard/orders');
    revalidatePath('/orders');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal mengubah status order' };
  }
}

// Get dashboard stats (admin)
export async function getDashboardStats() {
  const allOrders = await db.select().from(orders);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayOrders = allOrders.filter(o => o.createdAt && new Date(o.createdAt) >= todayStart);
  const paidOrders = allOrders.filter(o => o.paidAt !== null);
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const todayRevenue = paidOrders
    .filter(o => o.paidAt && new Date(o.paidAt) >= todayStart)
    .reduce((sum, o) => sum + Number(o.total), 0);
  const weekRevenue = paidOrders
    .filter(o => o.paidAt && new Date(o.paidAt) >= weekStart)
    .reduce((sum, o) => sum + Number(o.total), 0);
  const monthRevenue = paidOrders
    .filter(o => o.paidAt && new Date(o.paidAt) >= monthStart)
    .reduce((sum, o) => sum + Number(o.total), 0);

  const ordersByStatus: Record<string, number> = {};
  for (const order of allOrders) {
    const status = order.status || 'waiting_payment';
    ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
  }

  const allProducts = await db.select().from(products);

  return {
    totalOrders: allOrders.length,
    todayOrders: todayOrders.length,
    totalRevenue,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    waitingPaymentOrders: ordersByStatus['waiting_payment'] || 0,
    packingOrders: ordersByStatus['packing'] || 0,
    shippingOrders: ordersByStatus['shipping'] || 0,
    ordersByStatus,
    totalProducts: allProducts.length,
    activeProducts: allProducts.filter(p => p.isActive).length,
  };
}
