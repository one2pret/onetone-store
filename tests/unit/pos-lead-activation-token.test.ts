import { describe, expect, it } from 'vitest';
import {
  hashPosLeadActivationToken,
  isValidPosLeadActivationToken,
  issuePosLeadActivationToken,
  POS_LEAD_ACTIVATION_MINUTES,
} from '@/lib/pos-lead-activation-token';

describe('POS lead activation token', () => {
  it('issues a high-entropy token and stores a one-way SHA-256 hash', () => {
    const now = new Date('2026-09-28T00:00:00.000Z');
    const issued = issuePosLeadActivationToken(now);

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.tokenHash).not.toContain(issued.token);
    expect(issued.tokenHash).toBe(hashPosLeadActivationToken(issued.token));
    expect(issued.expiresAt.getTime()).toBe(
      now.getTime() + POS_LEAD_ACTIVATION_MINUTES * 60 * 1000,
    );
  });

  it('rejects malformed tokens before a database lookup', () => {
    expect(isValidPosLeadActivationToken('short')).toBe(false);
    expect(isValidPosLeadActivationToken('a'.repeat(43))).toBe(true);
    expect(isValidPosLeadActivationToken(`${'a'.repeat(42)}!`)).toBe(false);
  });
});
