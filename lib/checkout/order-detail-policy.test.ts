import { describe, expect, it } from 'vitest';
import { canReadOrderDetail, canUseLegacyXenditOrderSync } from './order-detail-policy';

describe('Customer order detail access', () => {
  it('allows owner to inspect their own order', () => {
    expect(canReadOrderDetail({
      requesterId: 10, requesterRole: 'customer', orderUserId: 10,
    })).toBe(true);
  });
  it('prevents reading another customer order or a guest order', () => {
    expect(canReadOrderDetail({
      requesterId: 10, requesterRole: 'customer', orderUserId: 11,
    })).toBe(false);
    expect(canReadOrderDetail({
      requesterId: 10, requesterRole: 'customer', orderUserId: null,
    })).toBe(false);
  });
  it('permits admins and rejects invalid user identifiers', () => {
    expect(canReadOrderDetail({
      requesterId: 1, requesterRole: 'admin', orderUserId: 45,
    })).toBe(true);
    expect(canReadOrderDetail({
      requesterId: Number.NaN, requesterRole: 'admin', orderUserId: 45,
    })).toBe(false);
  });
});

describe('Xendit page-load synchronizer', () => {
  it('never uses legacy payment or expiry handling for SBX orders', () => {
    expect(canUseLegacyXenditOrderSync('SBX-' + 'a'.repeat(36))).toBe(false);
    expect(canUseLegacyXenditOrderSync('SBX-INVALID')).toBe(false);
  });
  it('does not change legacy routing for ordinary web orders', () => {
    expect(canUseLegacyXenditOrderSync('ORD-2026-001')).toBe(true);
    expect(canUseLegacyXenditOrderSync('SUI-2026-004')).toBe(true);
  });
});
