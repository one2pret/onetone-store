import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiUser } from '@/lib/api-auth';
import { loadTrustedCheckoutSelection } from '@/lib/checkout/fresh-quote-service';

const schema = z.object({
  addressId: z.number().int().positive(),
  courierCompany: z.string().trim().min(1).max(64),
  courierType: z.string().trim().min(1).max(64),
  courierPrice: z.number().int().nonnegative(),
});

/**
 * Read-only checkout quote verification.
 * Never creates an order, reserves stock, or contacts Xendit.
 * Keep this endpoint disabled on production until full checkout hardening.
 */
export async function POST(request: Request) {
  if (process.env.CHECKOUT_QUOTE_VALIDATION_ENABLED !== 'true') {
    return NextResponse.json({ success: false, error: 'Not available' }, { status: 404 });
  }

  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON tidak valid' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: 'Data kurir atau alamat tidak valid',
    }, { status: 400 });
  }

  try {
    const { addressId, ...selection } = parsed.data;
    const result = await loadTrustedCheckoutSelection(user.id, addressId, selection);
    if (!result.ok) {
      const status = result.reason === 'address' ? 404
        : result.reason === 'rate_changed' ? 409
        : result.reason === 'cart' || result.reason === 'invalid_weight_or_coordinates' ? 422
        : 503;
      return NextResponse.json({
        success: false,
        error: result.reason === 'rate_changed'
          ? 'Tarif ongkir berubah. Perbarui pilihan kurir.'
          : 'Tarif tidak dapat divalidasi. Periksa alamat, keranjang, dan konfigurasi pengiriman.',
        code: result.reason,
      }, { status });
    }
    return NextResponse.json({
      success: true,
      data: {
        courierCompany: result.selected.courierCompany,
        courierType: result.selected.courierType,
        courierName: result.selected.courierName,
        courierServiceName: result.selected.courierServiceName,
        shippingCost: result.selected.price,
      },
    });
  } catch (error) {
    console.error('Checkout quote verification failed:', error);
    return NextResponse.json({
      success: false, error: 'Gagal memvalidasi ongkir',
    }, { status: 503 });
  }
}
