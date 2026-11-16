import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiUser } from '@/lib/api-auth';
import { loadTrustedCheckoutSelection } from '@/lib/checkout/fresh-quote-service';
import { loadReadOnlyCheckoutStock } from '@/lib/checkout/production-preflight-stock';
import { productionCheckoutPreflightEnabled } from '@/lib/checkout/production-preflight-policy';

const schema = z.object({
  addressId: z.number().int().positive(),
  courierCompany: z.string().trim().min(1).max(64),
  courierType: z.string().trim().min(1).max(64),
  courierPrice: z.number().int().nonnegative(),
}).strict();

/**
 * Stage 1 of production checkout hardening: READ ONLY, STAGING ONLY.
 * No orders, inventory reservations, invoices, payments or courier bookings.
 * A success is an advisory snapshot and cannot replace locked commit checks.
 */
export async function POST(request: Request) {
  if (!productionCheckoutPreflightEnabled(
    process.env.CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED,
    process.env.APP_ENV,
    process.env.XENDIT_SECRET_KEY,
  )) {
    return NextResponse.json({ success: false, error: 'Not available' }, { status: 404 });
  }

  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON tidak valid' }, { status: 400 });
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({
      success: false, error: 'Data alamat atau kurir tidak valid',
    }, { status: 400 });
  }

  try {
    const { addressId, ...selection } = parsed.data;
    const stock = await loadReadOnlyCheckoutStock(user.id);
    if (!stock.ok) {
      const status = stock.reason === 'stock_unavailable' ? 409
        : stock.reason === 'online_location' ? 503 : 422;
      return NextResponse.json({
        success: false, code: stock.reason,
        error: stock.reason === 'stock_unavailable'
          ? 'Stok Gudang Online tidak mencukupi. Perbarui keranjang.'
          : 'Keranjang atau konfigurasi stok belum memenuhi syarat checkout.',
      }, { status });
    }
    const quote = await loadTrustedCheckoutSelection(user.id, addressId, selection);
    if (!quote.ok) {
      const status = quote.reason === 'address' ? 404
        : quote.reason === 'rate_changed' ? 409
        : quote.reason === 'cart' || quote.reason === 'invalid_weight_or_coordinates'
          ? 422 : 503;
      return NextResponse.json({
        success: false, code: quote.reason,
        error: quote.reason === 'rate_changed'
          ? 'Tarif berubah. Perbarui pilihan kurir.'
          : 'Alamat, keranjang atau tarif pengiriman belum valid.',
      }, { status });
    }

    const shippingCost = quote.selected.price;
    const estimatedTotal = stock.subtotal + shippingCost;
    if (!Number.isSafeInteger(estimatedTotal) || estimatedTotal <= 0) {
      return NextResponse.json({
        success: false, code: 'invalid_total', error: 'Total checkout tidak valid',
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: {
        mode: 'staging_preflight_only',
        checkoutEnabled: false,
        checks: { inventory: 'pass', freshQuote: 'pass' },
        itemCount: stock.itemCount,
        subtotal: stock.subtotal,
        shippingCost,
        estimatedTotal,
        courierCompany: quote.selected.courierCompany,
        courierType: quote.selected.courierType,
        courierName: quote.selected.courierName,
        // A read-only check is not a stock reservation or price commitment.
        advisoryOnly: true,
      },
    });
  } catch (error) {
    console.error('Staging checkout preflight failed', error);
    return NextResponse.json({
      success: false, code: 'preflight_unavailable',
      error: 'Pemeriksaan checkout sementara tidak tersedia',
    }, { status: 503 });
  }
}
