import { describe, expect, it } from 'vitest';
import { sandboxOrderEnabled, sandboxOrderNumber } from './sandbox-order-policy';
import { checkoutSnapshotDigest } from './order-snapshot';

const address = {
  id: 1, userId: 2, recipientName: 'Test', phone: '000', address: 'Test',
  detail: null, latitude: '-6.9', longitude: '107.6',
};
const a = { productId: 3, variantId: null, quantity: 1, unitWeight: 200, unitPrice: 58000 };
const b = { productId: 4, variantId: 5, quantity: 2, unitWeight: 300, unitPrice: 99000 };

describe('gated staging checkout order', () => {
  it('requires opt-in AND Xendit development credentials', () => {
    expect(sandboxOrderEnabled('true', 'xnd_development_test')).toBe(true);
    expect(sandboxOrderEnabled(undefined, 'xnd_development_test')).toBe(false);
    expect(sandboxOrderEnabled('true', 'xnd_production_live')).toBe(false);
    expect(sandboxOrderEnabled('true', undefined)).toBe(false);
  });
  it('keeps order idempotent for same user/request UUID', () => {
    const key = 'dab0a14f-9135-4fda-8484-e4189c642086';
    const first = sandboxOrderNumber(42, key);
    expect(first).toBe(sandboxOrderNumber(42, key));
    expect(first).not.toBe(sandboxOrderNumber(43, key));
    expect(first.length).toBeLessThanOrEqual(50);
  });
  it('rejects stale cart/address snapshots and normalizes item order', () => {
    const first = checkoutSnapshotDigest({ address, items: [a, b] });
    expect(first).toBe(checkoutSnapshotDigest({ address, items: [b, a] }));
    expect(first).not.toBe(checkoutSnapshotDigest({ address, items: [{ ...a, quantity: 2 }, b] }));
    expect(first).not.toBe(checkoutSnapshotDigest({ address: { ...address, longitude: '107.7' }, items: [a, b] }));
    expect(first).not.toBe(checkoutSnapshotDigest({ address, items: [{ ...a, unitPrice: 60000 }, b] }));
  });
});
