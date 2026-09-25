import { describe, expect, it } from 'vitest';
import { calculateGrantExpiry, normalizeIndonesianPhone } from '@/lib/registration-utils';

describe('customer registration helpers', () => {
  it('normalizes common Indonesian phone formats', () => {
    expect(normalizeIndonesianPhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizeIndonesianPhone('+62 812 3456 7890')).toBe('6281234567890');
  });

  it('does not treat an invalid phone as a verified identity', () => {
    expect(normalizeIndonesianPhone('123')).toBeNull();
  });

  it('expires a welcome grant relative to registration', () => {
    const grantedAt = new Date('2026-09-23T00:00:00.000Z');
    expect(calculateGrantExpiry(grantedAt, 14, null)?.toISOString())
      .toBe('2026-10-07T00:00:00.000Z');
  });

  it('uses the campaign end when it is earlier', () => {
    const grantedAt = new Date('2026-09-23T00:00:00.000Z');
    const campaignEnd = new Date('2026-09-25T00:00:00.000Z');
    expect(calculateGrantExpiry(grantedAt, 14, campaignEnd)).toEqual(campaignEnd);
  });
});
