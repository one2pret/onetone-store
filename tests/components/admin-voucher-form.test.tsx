import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/app/actions/admin-vouchers', () => ({
  createVoucher: mocks.create,
  updateVoucher: mocks.update,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { VoucherForm } from '@/app/(admin)/dashboard/vouchers/_components/VoucherForm';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({
    success: false,
    errors: { startsAt: ['Tanggal atau zona waktu tidak valid'] },
  });
});
afterEach(cleanup);

describe('voucher campaign form safety', () => {
  it('keeps the filled campaign after a server validation error and sends browser offset again on retry', async () => {
    const { container } = render(<VoucherForm tiers={[]} />);
    const name = screen.getByLabelText('Nama voucher');
    const code = screen.getByLabelText('Kode voucher');
    const value = screen.getByLabelText('Nilai diskon (Rp)');
    const start = screen.getByLabelText('Mulai');
    const end = screen.getByLabelText('Selesai');

    fireEvent.change(name, { target: { value: 'UAT Voucher' } });
    fireEvent.change(code, { target: { value: 'UAT_VOUCHER' } });
    fireEvent.change(value, { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'new_user' } });
    fireEvent.change(start, { target: { value: '2026-11-27T06:36' } });
    fireEvent.change(end, { target: { value: '2026-11-28T06:36' } });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    await screen.findByText('Tanggal atau zona waktu tidak valid');
    expect(name).toHaveValue('UAT Voucher');
    expect(code).toHaveValue('UAT_VOUCHER');
    expect(value).toHaveValue(1000);
    expect(start).toHaveValue('2026-11-27T06:36');
    expect(end).toHaveValue('2026-11-28T06:36');
    expect(screen.getByLabelText('Audience')).toHaveValue('new_user');

    const firstFormData = mocks.create.mock.calls[0][1] as FormData;
    expect(firstFormData.get('timezoneOffsetMinutes')).toBe(String(new Date().getTimezoneOffset()));

    fireEvent.submit(form!);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    const retryFormData = mocks.create.mock.calls[1][1] as FormData;
    expect(retryFormData.get('timezoneOffsetMinutes')).toBe(String(new Date().getTimezoneOffset()));
    expect(retryFormData.get('startsAt')).toBe('2026-11-27T06:36');
  });
});
