import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockActivate = vi.fn();

vi.mock('@/lib/pos-lead-activation', () => ({
  activatePosCustomerLead: (...args: unknown[]) => mockActivate(...args),
}));

import { activatePosLead } from '@/app/actions/pos-lead-activation';

function activationForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values = {
    token: 'a'.repeat(43),
    email: 'MEMBER@EXAMPLE.COM',
    password: 'rahasia123',
    passwordConfirmation: 'rahasia123',
    ...overrides,
  };
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  return form;
}

describe('POS lead activation action', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects mismatched password confirmation without calling the service', async () => {
    const result = await activatePosLead(
      { success: false },
      activationForm({ passwordConfirmation: 'berbeda123' }),
    );

    expect(result.success).toBe(false);
    expect(result.errors?.passwordConfirmation).toEqual(['Konfirmasi password tidak sama']);
    expect(mockActivate).not.toHaveBeenCalled();
  });

  it('activates the lead and reports granted welcome vouchers', async () => {
    mockActivate.mockResolvedValue({
      success: true,
      email: 'member@example.com',
      welcomeVoucherCount: 1,
      linkedOrderCount: 2,
      pointsEarned: 12,
    });

    const result = await activatePosLead({ success: false }, activationForm());

    expect(mockActivate).toHaveBeenCalledWith({
      token: 'a'.repeat(43),
      email: 'MEMBER@EXAMPLE.COM',
      password: 'rahasia123',
    });
    expect(result).toEqual({
      success: true,
      email: 'member@example.com',
      welcomeVoucherCount: 1,
      linkedOrderCount: 2,
      pointsEarned: 12,
    });
  });
});
