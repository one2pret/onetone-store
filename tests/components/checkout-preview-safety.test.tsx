import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  quote: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/app/actions/shipping', () => ({
  calculateShippingRates: actions.quote,
}));
vi.mock('@/app/actions/orders', () => ({ createOrder: actions.create }));
vi.mock('@/app/actions/voucher', () => ({
  validateVoucher: vi.fn(),
  getAvailableVouchers: vi.fn(async () => []),
}));
vi.mock('@/app/actions/addresses', () => ({
  getUserAddresses: vi.fn(async () => []),
}));
vi.mock('@/components/shop/AddressSelector', () => ({
  AddressSelector: ({ onSelect }: { onSelect: (id: number) => void }) => (
    <button type="button" onClick={() => onSelect(2)}>Pilih alamat kedua</button>
  ),
}));
vi.mock('@/components/shop/ShippingOptions', () => ({
  ShippingOptions: ({ onSelect, loading }: {
    onSelect: (rate: unknown) => void; loading: boolean;
  }) => (
    <button type="button" disabled={loading} onClick={() => onSelect({
      price: 15_000,
      courier_name: 'JNE',
      courier_service_name: 'REG',
      courier_code: 'jne',
      courier_service_code: 'reg',
      duration: '2 days',
    })}>Pilih JNE REG</button>
  ),
}));

import { CheckoutForm } from '@/app/(checkout)/checkout/CheckoutForm';
import type { Address, CartItemWithProduct } from '@/lib/db/schema';

const addresses = [
  { id: 1, userId: 7, isDefault: true, recipientName: 'Pelanggan',
    phone: '081234567890', address: 'Alamat 1', district: 'A', city: 'Bandung', province: 'Jawa Barat' },
  { id: 2, userId: 7, isDefault: false, recipientName: 'Pelanggan',
    phone: '081234567890', address: 'Alamat 2', district: 'B', city: 'Bandung', province: 'Jawa Barat' },
] as unknown as Address[];
const cart: CartItemWithProduct[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  actions.quote.mockResolvedValue({ success: true, data: {
    express: [], regular: [], economy: [],
  }, route: null });
});
afterEach(cleanup);

async function chooseCourier() {
  fireEvent.click(screen.getByRole('button', { name: /Pilih Kurir/ }));
  const rate = await screen.findByRole('button', { name: 'Pilih JNE REG' });
  await waitFor(() => expect(rate).not.toBeDisabled());
  fireEvent.click(rate);
}

describe('checkout wizard preview safety', () => {
  it('shows a positive total and the exact point count without burning fractional value', async () => {
    render(<CheckoutForm addresses={addresses} cart={cart}
      subtotal={10_050} tierFreeShipping={false} pointsBalance={300} />);
    await chooseCourier();
    fireEvent.click(screen.getByRole('button', { name: /Review Pesanan/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Gunakan poin untuk pesanan ini' }));

    // Rp10.050 + Rp15.000 shipping => 250 points of Rp100, Rp50 still payable.
    expect(screen.getByText(/250 poin digunakan/)).toBeInTheDocument();
    expect(screen.getByText(/Sisa 50 poin/)).toBeInTheDocument();
    expect(screen.getByText('Rp50')).toBeInTheDocument();
    expect(screen.getByText('Total pembayaran')).toBeInTheDocument();
    expect(actions.create).not.toHaveBeenCalled();
  });

  it('clears selected courier rate when changing delivery address', async () => {
    render(<CheckoutForm addresses={addresses} cart={cart}
      subtotal={100_000} tierFreeShipping={false} pointsBalance={0} />);
    await chooseCourier();
    fireEvent.click(screen.getByRole('button', { name: /Review Pesanan/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ubah Kurir/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ubah Alamat/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pilih alamat kedua' }));
    fireEvent.click(screen.getByRole('button', { name: /Pilih Kurir/ }));
    const next = await screen.findByRole('button', { name: /Review Pesanan/ });
    await waitFor(() => expect(next).toBeDisabled());
    expect(actions.quote).toHaveBeenCalledWith(2);
    expect(actions.create).not.toHaveBeenCalled();
  });
});
