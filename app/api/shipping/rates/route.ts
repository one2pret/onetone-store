// app/api/shipping/rates/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiUser } from '@/lib/api-auth';
import type { BitshipRate } from '@/lib/bitship';
import { loadFreshCheckoutRates } from '@/lib/checkout/fresh-quote-service';

interface GroupedRates {
  express: BitshipRate[];
  regular: BitshipRate[];
  economy: BitshipRate[];
}

const requestSchema = z.object({
  addressId: z.coerce.number().int().positive(),
});

// POST /api/shipping/rates — customer-facing quote preview. This and
// /api/checkout/validate-quote share the same server-owned cart/weight/price
// calculation, so a preview cannot accidentally use a different request shape.
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON tidak valid' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'addressId wajib diisi' }, { status: 400 });
  }

  try {
    const result = await loadFreshCheckoutRates(user.id, parsed.data.addressId);
    if (!result.ok) {
      const status = result.reason === 'address' ? 404
        : result.reason === 'cart' ? 400
        : result.reason === 'invalid_weight_or_coordinates' ? 422
        : 503;
      const error = result.reason === 'address' ? 'Alamat tidak ditemukan'
        : result.reason === 'cart' ? 'Keranjang kosong'
        : result.reason === 'invalid_weight_or_coordinates'
          ? 'Berat produk atau koordinat alamat belum valid. Perbarui data sebelum checkout.'
          : 'Pengiriman belum tersedia. Periksa pengaturan asal dan kurir.';
      return NextResponse.json({ success: false, error, code: result.reason }, { status });
    }

    const grouped: GroupedRates = { express: [], regular: [], economy: [] };
    for (const rate of result.rates) {
      const type = rate.type as keyof GroupedRates;
      if (type in grouped) grouped[type].push(rate);
      else grouped.regular.push(rate);
    }
    // Response shape unchanged for existing web and Flutter clients.
    return NextResponse.json({ success: true, data: grouped });
  } catch (error) {
    console.error('Shipping rates error:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal menghitung ongkir' },
      { status: 503 },
    );
  }
}
