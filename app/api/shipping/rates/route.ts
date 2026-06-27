// app/api/shipping/rates/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addresses, storeSettings, couriers, cartItems, products } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';
import { getShippingRates } from '@/lib/bitship';
import type { BitshipRate } from '@/lib/bitship';

interface GroupedRates {
  express: BitshipRate[];
  regular: BitshipRate[];
  economy: BitshipRate[];
}

// POST /api/shipping/rates — calculate shipping rates for an address
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { addressId } = await request.json();

    if (!addressId) {
      return NextResponse.json(
        { success: false, error: 'addressId wajib diisi' },
        { status: 400 },
      );
    }

    // 1. Verify address ownership
    const addressRows = await db.select().from(addresses)
      .where(eq(addresses.id, Number(addressId)))
      .limit(1);

    if (addressRows.length === 0 || addressRows[0].userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Alamat tidak ditemukan' },
        { status: 404 },
      );
    }
    const address = addressRows[0];

    // 2. Get store origin
    const settings = await db.select().from(storeSettings);
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const originLat = settingsMap['store_latitude'];
    const originLng = settingsMap['store_longitude'];
    if (!originLat || !originLng) {
      return NextResponse.json(
        { success: false, error: 'Lokasi toko belum dikonfigurasi' },
        { status: 500 },
      );
    }

    // 3. Active couriers
    const activeCouriers = await db.select().from(couriers).where(eq(couriers.isActive, true));
    if (activeCouriers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada kurir aktif' },
        { status: 500 },
      );
    }

    // 4. Cart items
    const cart = await db.select().from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, user.id));

    if (cart.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Keranjang kosong' },
        { status: 400 },
      );
    }

    // 5. Build items
    const bitshipItems = cart.map(row => ({
      name: row.products!.name,
      weight: (row.products!.weight ?? 0) * (row.cart_items.quantity ?? 1),
      quantity: row.cart_items.quantity ?? 1,
      value: Number(row.products!.price) * (row.cart_items.quantity ?? 1),
    }));

    // 6. Fetch rates
    const courierCodes = activeCouriers.map(c => c.code).join(',');
    const rates = await getShippingRates({
      origin_latitude: originLat,
      origin_longitude: originLng,
      destination_latitude: address.latitude || '0',
      destination_longitude: address.longitude || '0',
      couriers: courierCodes,
      items: bitshipItems,
    });

    // 7. Group
    const grouped: GroupedRates = { express: [], regular: [], economy: [] };
    for (const rate of rates) {
      const type = rate.type as keyof GroupedRates;
      if (grouped[type]) {
        grouped[type].push(rate);
      } else {
        grouped.regular.push(rate);
      }
    }

    return NextResponse.json({ success: true, data: grouped });
  } catch (error) {
    console.error('Shipping rates error:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal menghitung ongkir' },
      { status: 500 },
    );
  }
}
