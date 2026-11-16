import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  stock: vi.fn(),
  quote: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({ getApiUser: mocks.user }));
vi.mock('@/lib/checkout/production-preflight-stock', () => ({
  loadReadOnlyCheckoutStock: mocks.stock,
}));
vi.mock('@/lib/checkout/fresh-quote-service', () => ({
  loadTrustedCheckoutSelection: mocks.quote,
}));

import { POST } from '@/app/api/checkout/production-preflight/route';
import { productionCheckoutPreflightEnabled } from '@/lib/checkout/production-preflight-policy';

const request = (body: unknown) => new Request('http://localhost/api/checkout/production-preflight', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const valid = {
  addressId: 3, courierCompany: 'jne', courierType: 'reg', courierPrice: 9000,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_ENV', 'staging');
  vi.stubEnv('CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED', 'true');
  vi.stubEnv('XENDIT_SECRET_KEY', 'xnd_development_FAKE_FOR_UNIT_TEST');
  mocks.user.mockResolvedValue({ id: 2, role: 'customer' });
  mocks.stock.mockResolvedValue({ ok: true, subtotal: 35000, itemCount: 1 });
  mocks.quote.mockResolvedValue({ ok: true, selected: {
    courierCompany: 'jne', courierType: 'reg',
    courierName: 'JNE', courierServiceName: 'Reguler', price: 9000,
  }, snapshot: 'test-snapshot' });
});
afterEach(() => vi.unstubAllEnvs());

describe('staging-only production checkout read-only preflight', () => {
  it('fails closed by default or with production credentials and cannot be enabled on production', async () => {
    expect(productionCheckoutPreflightEnabled(undefined, 'staging', 'xnd_development_test')).toBe(false);
    expect(productionCheckoutPreflightEnabled('true', 'production', 'xnd_development_test')).toBe(false);
    expect(productionCheckoutPreflightEnabled('true', 'staging', 'xnd_production_test')).toBe(false);
    expect(productionCheckoutPreflightEnabled('true', 'staging', 'xnd_development_test')).toBe(true);
    vi.stubEnv('APP_ENV', 'production');
    const response = await POST(request(valid));
    expect(response.status).toBe(404);
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.stock).not.toHaveBeenCalled();
    expect(mocks.quote).not.toHaveBeenCalled();
  });

  it('rejects missing flag and a live Xendit key before auth or provider lookup', async () => {
    vi.stubEnv('CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED', 'false');
    expect((await POST(request(valid))).status).toBe(404);
    vi.stubEnv('CHECKOUT_PRODUCTION_PREFLIGHT_ENABLED', 'true');
    vi.stubEnv('XENDIT_SECRET_KEY', 'xnd_production_FAKE');
    expect((await POST(request(valid))).status).toBe(404);
    expect(mocks.user).not.toHaveBeenCalled();
  });

  it('requires authenticated user and a strict request schema', async () => {
    mocks.user.mockResolvedValueOnce(null);
    expect((await POST(request(valid))).status).toBe(401);
    expect((await POST(request({ ...valid, courierPrice: -1 }))).status).toBe(400);
    expect((await POST(request({ ...valid, courierPrice: 1.1 }))).status).toBe(400);
    expect((await POST(request({ ...valid, extra: 'unsafe' }))).status).toBe(400);
    expect((await POST(new Request('http://localhost/api/checkout/production-preflight', {
      method: 'POST', body: '{bad-json',
    }))).status).toBe(400);
    expect(mocks.stock).not.toHaveBeenCalled();
    expect(mocks.quote).not.toHaveBeenCalled();
  });

  it('provides only advisory server-owned totals with no payment or order action', async () => {
    const response = await POST(request(valid));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: {
      mode: 'staging_preflight_only', checkoutEnabled: false,
      checks: { inventory: 'pass', freshQuote: 'pass' },
      itemCount: 1, subtotal: 35000,
      shippingCost: 9000, estimatedTotal: 44000,
      courierCompany: 'jne', courierType: 'reg', courierName: 'JNE',
      advisoryOnly: true,
    } });
    expect(mocks.stock).toHaveBeenCalledWith(2);
    expect(mocks.quote).toHaveBeenCalledWith(2, 3, {
      courierCompany: 'jne', courierType: 'reg', courierPrice: 9000,
    });
    expect(JSON.stringify(body)).not.toContain('snapshot');
    expect(JSON.stringify(body)).not.toContain('paymentUrl');
  });

  it('rejects insufficient online stock before calling the quote provider', async () => {
    mocks.stock.mockResolvedValueOnce({ ok: false, reason: 'stock_unavailable' });
    const response = await POST(request(valid));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('stock_unavailable');
    expect(mocks.quote).not.toHaveBeenCalled();
  });

  it('rejects missing online inventory setup and invalid quantity', async () => {
    mocks.stock.mockResolvedValueOnce({ ok: false, reason: 'online_location' });
    expect((await POST(request(valid))).status).toBe(503);
    mocks.stock.mockResolvedValueOnce({ ok: false, reason: 'invalid_quantity' });
    expect((await POST(request(valid))).status).toBe(422);
  });

  it('rejects client courier price or service when a fresh quote has changed', async () => {
    mocks.quote.mockResolvedValueOnce({ ok: false, reason: 'rate_changed' });
    const response = await POST(request(valid));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('rate_changed');
  });

  it('rejects an address that is not owned by the caller', async () => {
    mocks.quote.mockResolvedValueOnce({ ok: false, reason: 'address' });
    const response = await POST(request(valid));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('address');
  });

  it('rejects malformed totals and a temporary provider failure', async () => {
    mocks.stock.mockResolvedValueOnce({ ok: true, subtotal: Number.MAX_SAFE_INTEGER, itemCount: 1 });
    expect((await POST(request(valid))).status).toBe(422);
    mocks.stock.mockRejectedValueOnce(new Error('test backend failure'));
    expect((await POST(request(valid))).status).toBe(503);
  });
});
