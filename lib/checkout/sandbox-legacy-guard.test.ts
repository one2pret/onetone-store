import { describe, expect, it } from 'vitest';
import { isSandboxOrder, SANDBOX_LEGACY_BLOCKED_MESSAGE } from './sandbox-legacy-guard';

describe('protect sandbox lifecycle from legacy actions', () => {
  it('classifies sandbox orders, including malformed SBX prefixes, as protected', () => {
    expect(isSandboxOrder('SBX-' + 'a'.repeat(36))).toBe(true);
    expect(isSandboxOrder('SBX-INVALID')).toBe(true);
  });
  it('preserves behavior for web, POS and missing order numbers', () => {
    expect(isSandboxOrder('ORD-2026-001')).toBe(false);
    expect(isSandboxOrder('POS-123')).toBe(false);
    expect(isSandboxOrder(null)).toBe(false);
    expect(isSandboxOrder(undefined)).toBe(false);
  });
  it('returns an explicit safety explanation', () => {
    expect(SANDBOX_LEGACY_BLOCKED_MESSAGE).toContain('sandbox TEST');
  });
});
