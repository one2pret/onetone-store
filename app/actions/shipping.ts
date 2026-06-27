// app/actions/shipping.ts
'use server';

import { db } from '@/lib/db';
import {
  addresses, storeSettings, couriers, cartItems, products,
  orders, shippings, orderItems, orderStatusLogs,
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getShippingRates as fetchBitshipRates, createShipment } from '@/lib/bitship';
import type { BitshipRate } from '@/lib/bitship';

interface GroupedRates {
  express: BitshipRate[];
  regular: BitshipRate[];
  economy: BitshipRate[];
}

export interface ShippingRouteInfo {
  originCity: string;
  destinationCity: string;
}

export async function calculateShippingRates(addressId: number): Promise<{
  success: boolean;
  error?: string;
  data?: GroupedRates;
  route?: ShippingRouteInfo;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }
  const userId = Number(session.user.id);

  try {
    // 1. Get & verify address
    const addressRows = await db.select().from(addresses).where(eq(addresses.id, addressId)).limit(1);
    if (addressRows.length === 0 || addressRows[0].userId !== userId) {
      return { success: false, error: 'Alamat tidak ditemukan atau bukan milik Anda' };
    }
    const address = addressRows[0];

    // 2. Get store origin from settings
    const settings = await db.select().from(storeSettings);
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const originLat = settingsMap['store_latitude'];
    const originLng = settingsMap['store_longitude'];
    if (!originLat || !originLng) {
      return { success: false, error: 'Lokasi toko belum dikonfigurasi' };
    }

    // 3. Get active couriers
    const activeCouriers = await db.select().from(couriers).where(eq(couriers.isActive, true));
    if (activeCouriers.length === 0) {
      return { success: false, error: 'Tidak ada kurir aktif' };
    }

    // 4. Get cart items with product info
    const cart = await db.select().from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, userId));

    if (cart.length === 0) {
      return { success: false, error: 'Keranjang kosong' };
    }

    // 5. Build items with weight
    const bitshipItems = cart.map(row => ({
      name: row.products!.name,
      weight: (row.products!.weight ?? 0) * (row.cart_items.quantity ?? 1),
      quantity: row.cart_items.quantity ?? 1,
      value: Number(row.products!.price) * (row.cart_items.quantity ?? 1),
    }));

    // 6. Call Bitship
    const courierCodes = activeCouriers.map(c => c.code).join(',');
    const rates = await fetchBitshipRates({
      origin_latitude: originLat,
      origin_longitude: originLng,
      destination_latitude: address.latitude || '0',
      destination_longitude: address.longitude || '0',
      couriers: courierCodes,
      items: bitshipItems,
    });

    // 7. Group by type
    const grouped: GroupedRates = { express: [], regular: [], economy: [] };
    for (const rate of rates) {
      const type = rate.type as keyof GroupedRates;
      if (grouped[type]) {
        grouped[type].push(rate);
      } else {
        grouped.regular.push(rate);
      }
    }

    const route: ShippingRouteInfo = {
      originCity: settingsMap['store_address'] || 'Toko',
      destinationCity: [address.district, address.city].filter(Boolean).join(', '),
    };

    return { success: true, data: grouped, route };
  } catch (error) {
    console.error('Calculate shipping rates error:', error);
    return { success: false, error: 'Gagal menghitung ongkir' };
  }
}

export async function sendOrderToBitship(orderId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return { success: false, error: 'Hanya admin yang dapat mengirim order' };
  }

  try {
    // 1. Get order
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (orderRows.length === 0) {
      return { success: false, error: 'Order tidak ditemukan' };
    }
    const order = orderRows[0];

    if (order.status !== 'packing') {
      return { success: false, error: 'Order harus berstatus packing untuk dikirim' };
    }

    // 2. Get shipping record
    const shippingRows = await db.select().from(shippings).where(eq(shippings.orderId, orderId)).limit(1);
    // 3. Get store settings
    const settings = await db.select().from(storeSettings);
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    if (shippingRows.length === 0) {
      return { success: false, error: 'Data shipping tidak ditemukan' };
    }
    const shipping = shippingRows[0];

    // Idempotent: already has trackingId
    if (shipping.trackingId) {
      // Just ensure order transitions to shipping
      await db.update(orders).set({ status: 'shipping', shippingAt: new Date() }).where(eq(orders.id, orderId));
      await db.insert(orderStatusLogs).values({
        orderId,
        fromStatus: 'packing',
        toStatus: 'shipping',
        changedBy: `admin:${session.user.id}`,
        note: 'Sudah ada tracking, skip Bitship call',
      });
      revalidatePath('/dashboard/orders');
      revalidatePath('/orders');
      return { success: true };
    }

    // 4. Get order items for Bitship
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    // Get product weights
    const bitshipItems = [];
    for (const item of items) {
      let weight = 0;
      if (item.productId) {
        const productRows = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
        weight = productRows[0]?.weight ?? 0;
      }
      bitshipItems.push({
        name: item.productName,
        weight: weight * item.quantity,
        quantity: item.quantity,
        value: Number(item.price) * item.quantity,
      });
    }

    // 5. Call Bitship createShipment
    const shipmentResult = await createShipment({
      origin_contact_name: settingsMap['store_name'] || 'Store',
      origin_contact_phone: settingsMap['store_phone'] || '',
      origin_address: settingsMap['store_address'] || '',
      origin_coordinate: {
        latitude: Number(settingsMap['store_latitude'] || 0),
        longitude: Number(settingsMap['store_longitude'] || 0),
      },
      destination_contact_name: shipping.recipientName,
      destination_contact_phone: shipping.phone,
      destination_address: shipping.address,
      destination_coordinate: {
        latitude: Number(shipping.latitude || 0),
        longitude: Number(shipping.longitude || 0),
      },
      courier_company: shipping.courierCompany || '',
      courier_type: shipping.courierType || '',
      delivery_type: 'later',
      items: bitshipItems,
    });

    // 6. Update shipping record with tracking
    await db.update(shippings)
      .set({
        trackingId: shipmentResult.id,
        waybillId: shipmentResult.waybill_id,
        status: 'confirmed',
      })
      .where(eq(shippings.id, shipping.id));

    // 7. Transition order to shipping
    await db.update(orders)
      .set({ status: 'shipping', shippingAt: new Date() })
      .where(eq(orders.id, orderId));

    // 8. Audit log
    await db.insert(orderStatusLogs).values({
      orderId,
      fromStatus: 'packing',
      toStatus: 'shipping',
      changedBy: `admin:${session.user.id}`,
    });

    revalidatePath('/dashboard/orders');
    revalidatePath('/orders');
    return { success: true };
  } catch (error) {
    console.error('Send order to Bitship error:', error);
    return { success: false, error: 'Gagal membuat pengiriman' };
  }
}
