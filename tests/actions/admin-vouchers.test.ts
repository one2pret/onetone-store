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

  it('stores browser-local campaign dates as UTC', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    const returningId = vi.fn().mockResolvedValue([{ id: 6 }]);
    const values = vi.fn().mockReturnValue({ $returningId: returningId });
    mockInsert.mockReturnValue({ values });

    const form = new FormData();
    form.set('code', 'WELCOME5000');
    form.set('name', 'Voucher pengguna baru');
    form.set('type', 'fixed');
    form.set('value', '5000');
    form.set('minSpend', '0');
    form.set('audience', 'new_user');
    form.set('validDaysAfterGrant', '14');
    form.set('maxUsesPerUser', '1');
    form.set('firstOrderOnly', 'on');
    form.set('isActive', 'on');
    form.set('timezoneOffsetMinutes', '-420');
    form.set('startsAt', '2026-09-28T16:40');
    form.set('endsAt', '2026-10-09T16:40');

    const result = await createVoucher(null, form);

    expect(result).toEqual({ success: true, voucherId: 6 });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      startsAt: new Date('2026-09-28T09:40:00.000Z'),
      endsAt: new Date('2026-10-09T09:40:00.000Z'),
    }));
  });

  it('rejects scheduled dates when the browser timezone offset is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    const form = new FormData();
    form.set('code', 'WELCOME5000');
    form.set('name', 'Voucher pengguna baru');
    form.set('type', 'fixed');
    form.set('value', '5000');
    form.set('minSpend', '0');
    form.set('audience', 'new_user');
    form.set('validDaysAfterGrant', '14');
    form.set('maxUsesPerUser', '1');
    form.set('isActive', 'on');
    form.set('startsAt', '2026-09-28T16:40');

    const result = await createVoucher(null, form);

    expect(result?.success).toBe(false);
    expect(result?.errors?.startsAt).toBeDefined();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
