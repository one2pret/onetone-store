import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuth, mockInsert, mockUpdate, mockDelete, mockSelect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: { insert: mockInsert, update: mockUpdate, delete: mockDelete, select: mockSelect },
}));

import { createVoucher, deleteOrArchiveVoucher, toggleVoucherActive } from '@/app/actions/admin-vouchers';

describe('admin voucher actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: '2', role: 'customer' } });
  });

  it('blocks voucher creation for non-admin users', async () => {
    const result = await createVoucher(null, new FormData());
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('blocks status changes and deletion for non-admin users', async () => {
    expect(await toggleVoucherActive(1, false)).toEqual({ success: false, error: 'Unauthorized' });
    expect(await deleteOrArchiveVoucher(1)).toEqual({ success: false, error: 'Unauthorized' });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('validates campaign fields before writing', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    const form = new FormData();
    form.set('code', 'bad code');
    form.set('name', 'A');
    form.set('type', 'percent');
    form.set('value', '150');
    form.set('audience', 'public');

    const result = await createVoucher(null, form);
    expect(result?.success).toBe(false);
    expect(result?.errors?.code).toBeDefined();
    expect(result?.errors?.value).toBeDefined();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
