// app/actions/orders.ts
'use server';

import { db } from '@/lib/db';
import {
  orders, orderItems, cartItems, products, users,
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

// Create order from cart (revamped with Xendit + shipping)
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
      .where(eq(addresses.id, addressId))
      .limit(1);

    if (addressRows.length === 0 || addressRows[0].userId !== userId) {
      return { success: false, error: 'Alamat tidak ditemukan atau bukan milik Anda' };
    }
    const address = addressRows[0];

    // 2. Get cart items with product info
    const cart = await db.select()
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, userId));

    if (cart.length === 0) {
      return { success: false, error: 'Keranjang kosong' };
    }

    // 3. Validate stock
    const stockItems = cart.map(row => ({
      productId: row.cart_items.productId,
      quantity: row.cart_items.quantity ?? 1,
      productName: row.products!.name,
    }));

    const stockResult = await validateStock(stockItems);
    if (!stockResult.valid) {
      return { success: false, error: stockResult.errors.join(', ') };
    }

    // 4. Calculate totals
    const subtotal = cart.reduce((sum, row) => {
      return sum + (Number(row.products!.price) * (row.cart_items.quantity ?? 1));
    }, 0);

    const total = subtotal + courierPrice;
    const orderNumber = generateOrderNumber();

    // 5. Create order (willExpiredAt set via MySQL NOW() + 24h for timezone consistency)
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

    // 7. Create order items
    await db.insert(orderItems).values(
      cart.map((row) => ({
        orderId,
        productId: row.cart_items.productId,
        productName: row.products!.name,
        productImage: row.products!.image,
        price: row.products!.price,
        quantity: row.cart_items.quantity ?? 1,
        subtotal: String(Number(row.products!.price) * (row.cart_items.quantity ?? 1)),
      }))
    );

    // 8. Create shipping record
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

    // 9. Deduct stock
    await deductStock(
      cart.map(row => ({
        productId: row.cart_items.productId,
        quantity: row.cart_items.quantity ?? 1,
      }))
    );

    // 10. Clear cart
    await db.delete(cartItems).where(eq(cartItems.userId, userId));

    // 11. Create Xendit invoice
    let paymentUrl: string | undefined;
    try {
      // Get user email
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

      // Store invoice
      await db.insert(invoices).values({
        orderId,
        xenditId: invoice.id,
        invoiceUrl: invoice.invoiceUrl,
        amount: String(total),
        status: 'pending',
        expiredAt: new Date(invoice.expiryDate),
      });
    } catch (xenditError) {
      // Order still created, customer can retry payment later
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
    // Get order
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, orderId)).limit(1);

    if (orderRows.length === 0 || orderRows[0].userId !== userId) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const order = orderRows[0];

    if (order.status !== 'waiting_payment') {
      return { success: false, error: 'Hanya order berstatus waiting_payment yang dapat dibatalkan' };
    }

    // Try to expire Xendit invoice
    const invoiceRows = await db.select().from(invoices)
      .where(eq(invoices.orderId, orderId)).limit(1);

    if (invoiceRows.length > 0 && invoiceRows[0].xenditId) {
      try {
        await expireInvoice(invoiceRows[0].xenditId);
      } catch {
        // Continue even if expire fails
      }
      await db.update(invoices).set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(invoices.id, invoiceRows[0].id));
    }

    // Restore stock
    await restoreStock(orderId);

    // Update order
    await db.update(orders).set({
      status: 'cancelled',
      cancelledAt: new Date(),
    }).where(eq(orders.id, orderId));

    // Audit log
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
    // Get order
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

    // For waiting_payment, check if invoice already exists
    if (isWaitingNoInvoice) {
      const existingInvoice = await db.select().from(invoices)
        .where(eq(invoices.orderId, orderId)).limit(1);
      if (existingInvoice.length > 0 && existingInvoice[0].invoiceUrl) {
        return { success: true, paymentUrl: existingInvoice[0].invoiceUrl };
      }
    }

    // Get order items for stock validation (only for expired → re-deduct)
    const items = await db.select().from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const stockItems = items.map(item => ({
      productId: item.productId!,
      quantity: item.quantity,
      productName: item.productName,
    }));

    // Get user email
    const userRows = await db.select().from(users)
      .where(eq(users.id, userId)).limit(1);
    const userEmail = userRows[0]?.email || '';

    // Validate stock
    const stockResult = await validateStock(stockItems);
    if (!stockResult.valid) {
      return { success: false, error: stockResult.errors.join(', ') };
    }

    // Create new Xendit invoice
    const invoice = await createInvoice({
      externalId: order.orderNumber!,
      amount: Number(order.total),
      payerEmail: userEmail,
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

      // Deduct stock again (was restored when expired)
      await deductStock(stockItems.map(i => ({ productId: i.productId, quantity: i.quantity })));

      // Audit log
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

// Cancel order by admin (waiting_payment or packing)
export async function cancelOrderByAdmin(orderId: number) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return { success: false, error: 'Hanya admin yang dapat membatalkan order' };
  }

  const adminId = session.user.id;

  try {
    // Get order
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

    // Try to expire Xendit invoice if waiting_payment
    if (order.status === 'waiting_payment') {
      const invoiceRows = await db.select().from(invoices)
        .where(eq(invoices.orderId, orderId)).limit(1);

      if (invoiceRows.length > 0 && invoiceRows[0].xenditId) {
        try {
          await expireInvoice(invoiceRows[0].xenditId);
        } catch {
          // Continue even if expire fails
        }
        await db.update(invoices).set({ status: 'cancelled', cancelledAt: new Date() })
          .where(eq(invoices.id, invoiceRows[0].id));
      }
    } else {
      // For packing — no invoice to expire, but still check
      const invoiceRows = await db.select().from(invoices)
        .where(eq(invoices.orderId, orderId)).limit(1);
      // Invoice already paid for packing, no need to expire
    }

    // Restore stock
    await restoreStock(orderId);

    // Update order
    await db.update(orders).set({
      status: 'cancelled',
      cancelledAt: new Date(),
    }).where(eq(orders.id, orderId));

    // Audit log
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

// Get order tracking info (customer with ownership check, or admin)
export async function getOrderTracking(orderId: number): Promise<{
  success: boolean;
  error?: string;
  data?: {
    shipping: any | null;
    histories: any[];
  };
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const userId = Number(session.user.id);
  const isAdmin = (session.user as any).role === 'admin';

  try {
    // Get order
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, orderId)).limit(1);

    if (orderRows.length === 0) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const order = orderRows[0];

    // Ownership check (skip for admin)
    if (!isAdmin && order.userId !== userId) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    // Get shipping record
    const shippingRows = await db.select().from(shippings)
      .where(eq(shippings.orderId, orderId)).limit(1);

    if (shippingRows.length === 0) {
      return { success: true, data: { shipping: null, histories: [] } };
    }

    const shipping = shippingRows[0];

    // Get shipping histories
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
  if (!session?.user?.id) {
    return [];
  }

  const userId = Number(session.user.id);

  const orderRows = await db.select().from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));

  return queryOrdersWithItems(orderRows);
}

// Get single order
export async function getOrder(id: number) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

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

// Update order status (admin — legacy, kept for simple updates)
export async function updateOrderStatus(orderId: number, status: string) {
  try {
    await db.update(orders)
      .set({ status: status as any })
      .where(eq(orders.id, orderId));

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
    // Get current order
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (orderRows.length === 0) {
      return { success: false, error: 'Order tidak ditemukan' };
    }

    const order = orderRows[0];
    const currentStatus = order.status!;

    // Validate transition
    if (!validateStatusTransition(currentStatus, newStatus)) {
      return {
        success: false,
        error: `Transisi status dari "${currentStatus}" ke "${newStatus}" tidak valid`,
      };
    }

    // Build update fields with relevant timestamp
    // Use sql`NOW()` to match MySQL timezone (avoids JS UTC vs MySQL local mismatch)
    const updateData: Record<string, any> = { status: newStatus as any };

    switch (newStatus) {
      case 'packing':
        updateData.paidAt = sql`NOW()`;
        break;
      case 'shipping':
        updateData.shippingAt = sql`NOW()`;
        break;
      case 'delivered':
        updateData.deliveredAt = sql`NOW()`;
        break;
      case 'expired':
        updateData.expiredAt = sql`NOW()`;
        break;
      case 'cancelled':
        updateData.cancelledAt = sql`NOW()`;
        break;
    }

    // Update order
    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    // Insert audit log
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

  const todayOrders = allOrders.filter(o =>
    o.createdAt && new Date(o.createdAt) >= todayStart
  );

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

  // Count per status
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
