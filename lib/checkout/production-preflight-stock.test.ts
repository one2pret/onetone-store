import { describe, expect, it } from 'vitest';
import { assessOnlineCheckoutStock } from './production-preflight-stock';

const standardItem = {
  productId: 12,
  variantId: null,
  quantity: 2,
  productActive: true,
  productChannel: 'all',
  productStock: 10,
  variantActive: null,
  variantProductId: null,
  variantStock: null,
  unitWeight: 250,
  unitPrice: 35000,
};
const standardBalance = {
  productId: 12, variantId: null, quantity: 10, reserved: 3,
};

describe('server-owned online stock preflight (read-only advisory)', () => {
  it('returns a subtotal only when product stock AND unreserved online stock suffice', () => {
    expect(assessOnlineCheckoutStock([standardItem], [standardBalance]))
      .toEqual({ ok: true, subtotal: 70000, itemCount: 2 });
  });

  it('rejects an empty cart or inactive/offline product', () => {
    expect(assessOnlineCheckoutStock([], [])).toEqual({ ok: false, reason: 'cart_empty' });
    expect(assessOnlineCheckoutStock([{ ...standardItem, productActive: false }], [standardBalance]))
      .toEqual({ ok: false, reason: 'invalid_item' });
    expect(assessOnlineCheckoutStock([{ ...standardItem, productChannel: 'store_only' }], [standardBalance]))
      .toEqual({ ok: false, reason: 'invalid_item' });
  });

  it('rejects invalid quantities, weights, prices and integer overflow', () => {
    expect(assessOnlineCheckoutStock([{ ...standardItem, quantity: -1 }], [standardBalance]))
      .toEqual({ ok: false, reason: 'invalid_quantity' });
    expect(assessOnlineCheckoutStock([{ ...standardItem, quantity: 0 }], [standardBalance]))
      .toEqual({ ok: false, reason: 'invalid_quantity' });
    expect(assessOnlineCheckoutStock([{ ...standardItem, unitWeight: 0 }], [standardBalance]))
      .toEqual({ ok: false, reason: 'invalid_weight' });
    expect(assessOnlineCheckoutStock([{ ...standardItem, unitPrice: -1 }], [standardBalance]))
      .toEqual({ ok: false, reason: 'invalid_price' });
    expect(assessOnlineCheckoutStock([{ ...standardItem, unitPrice: Number.MAX_SAFE_INTEGER }], [standardBalance]))
      .toEqual({ ok: false, reason: 'invalid_price' });
  });

  it('rejects nonexistent, malformed and unrelated variants', () => {
    const item = { ...standardItem, variantId: 44, variantActive: true,
      variantProductId: 13, variantStock: 10 };
    expect(assessOnlineCheckoutStock([item], [{ ...standardBalance, variantId: 44 }]))
      .toEqual({ ok: false, reason: 'invalid_variant' });
    expect(assessOnlineCheckoutStock([{ ...item, variantProductId: 12, variantActive: false }],
      [{ ...standardBalance, variantId: 44 }]))
      .toEqual({ ok: false, reason: 'invalid_variant' });
  });

  it('requires both the variant stock cache and its exact online balance', () => {
    const item = { ...standardItem, variantId: 44, variantActive: true,
      variantProductId: 12, variantStock: 2 };
    expect(assessOnlineCheckoutStock([item], [standardBalance]))
      .toEqual({ ok: false, reason: 'stock_unavailable' });
    expect(assessOnlineCheckoutStock([item], [{ ...standardBalance, variantId: 44 }]))
      .toEqual({ ok: true, subtotal: 70000, itemCount: 2 });
    expect(assessOnlineCheckoutStock([{ ...item, variantStock: 1 }],
      [{ ...standardBalance, variantId: 44 }]))
      .toEqual({ ok: false, reason: 'stock_unavailable' });
  });

  it('aggregates duplicate cart lines before comparing inventory availability', () => {
    const split = { ...standardItem, quantity: 3 };
    expect(assessOnlineCheckoutStock([split, split], [{ ...standardBalance, quantity: 8, reserved: 3 }]))
      .toEqual({ ok: false, reason: 'stock_unavailable' });
    expect(assessOnlineCheckoutStock([split, split], [{ ...standardBalance, quantity: 9, reserved: 3 }]))
      .toEqual({ ok: true, subtotal: 210000, itemCount: 6 });
  });

  it('rejects reserved balances, missing balance and duplicate balance rows', () => {
    expect(assessOnlineCheckoutStock([standardItem], [{ ...standardBalance, reserved: 9 }]))
      .toEqual({ ok: false, reason: 'stock_unavailable' });
    expect(assessOnlineCheckoutStock([standardItem], []))
      .toEqual({ ok: false, reason: 'stock_unavailable' });
    expect(assessOnlineCheckoutStock([standardItem], [standardBalance, standardBalance]))
      .toEqual({ ok: false, reason: 'stock_unavailable' });
  });
});
