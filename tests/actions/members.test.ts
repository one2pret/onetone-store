import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuth, mockSelect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({ db: { select: mockSelect } }));

import { getMember, getMemberOrders, getMembers, getMemberTiers } from '@/app/actions/members';

describe('Member Server Actions authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'customer' } });
  });

  it('does not expose the member list to a customer', async () => {
    expect(await getMembers()).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('does not expose member profile or order data to a customer', async () => {
    expect(await getMember(1)).toBeNull();
    expect(await getMemberOrders(1)).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('does not expose admin tier data to a customer', async () => {
    expect(await getMemberTiers()).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
