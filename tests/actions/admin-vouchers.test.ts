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

import { createVoucher, deleteOrArchiveVoucher, toggleVoucherActive, updateVoucher } from '@/app/actions/admin-vouchers';

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
    expect(result?.errors?.startsAt?.[0]).toMatch(/Tanggal atau zona waktu tidak valid/);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rejects malformed campaign dates without persisting shifted time', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    const form = new FormData();
    form.set('code', 'UAT_DATE_CHECK');
    form.set('name', 'UAT date validation');
    form.set('type', 'fixed');
    form.set('value', '1000');
    form.set('audience', 'new_user');
    form.set('validDaysAfterGrant', '1');
    form.set('timezoneOffsetMinutes', '-420');
    form.set('startsAt', '27/11/2026, 06.36');
    const result = await createVoucher(null, form);
    expect(result?.errors?.startsAt?.[0]).toMatch(/Tanggal atau zona waktu tidak valid/);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('allows optional dates to stay blank and stores null without guessing a timezone', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    const returningId = vi.fn().mockResolvedValue([{ id: 9 }]);
    const values = vi.fn().mockReturnValue({ $returningId: returningId });
    mockInsert.mockReturnValue({ values });
    const form = new FormData();
    form.set('code', 'UAT_NO_DATES');
    form.set('name', 'UAT no dates');
    form.set('type', 'fixed');
    form.set('value', '1000');
    form.set('audience', 'new_user');
    form.set('validDaysAfterGrant', '1');
    form.set('startsAt', '');
    form.set('endsAt', '');
    const result = await createVoucher(null, form);
    expect(result).toEqual({ success: true, voucherId: 9 });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ startsAt: null, endsAt: null }));
  });

  it('updates campaign dates using the client offset and preserves existing voucher identity', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    const current = { id: 5, code: 'UAT_DATE_EDIT', type: 'fixed', value: 1000, audience: 'new_user' };
    const results = [[current], [], []];
    mockSelect.mockImplementation(() => ({
      from: () => ({ where: () => ({ limit: async () => results.shift() }) }),
    }));
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    mockUpdate.mockReturnValue({ set });

    const form = new FormData();
    form.set('code', current.code);
    form.set('name', 'UAT campaign update');
    form.set('type', 'fixed');
    form.set('value', '1000');
    form.set('audience', 'new_user');
    form.set('validDaysAfterGrant', '1');
    form.set('timezoneOffsetMinutes', '-420');
    form.set('startsAt', '2026-11-27T06:36');
    form.set('endsAt', '2026-11-28T06:36');

    const result = await updateVoucher(5, null, form);
    expect(result).toEqual({ success: true, voucherId: 5 });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      startsAt: new Date('2026-11-26T23:36:00.000Z'),
      endsAt: new Date('2026-11-27T23:36:00.000Z'),
    }));
  });
});
