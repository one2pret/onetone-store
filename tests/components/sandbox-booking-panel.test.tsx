import React from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SandboxBookingPanel } from '@/app/(admin)/dashboard/orders/[id]/SandboxBookingPanel';
const actions = vi.hoisted(() => ({ preview: vi.fn(), book: vi.fn(), reconcile: vi.fn() }));
vi.mock('@/app/actions/sandbox-booking', () => ({ previewSandboxBooking: actions.preview, bookSandboxShipment: actions.book, reconcileSandboxShipment: actions.reconcile }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
beforeEach(() => {
  vi.clearAllMocks();
  actions.preview.mockResolvedValue({ success: true, hash: 'reviewed', payload: {
    origin_contact_name: 'Test store', origin_contact_phone: '08123', origin_address: 'Test origin', origin_coordinate: { latitude: -6.2, longitude: 106.8 },
    destination_contact_name: 'Test recipient', destination_contact_phone: '08123', destination_address: 'Test destination', destination_coordinate: { latitude: -6.3, longitude: 106.9 },
    courier_company: 'jne', courier_type: 'reg', items: [{ name: 'Test shirt', quantity: 2, weight: 200, value: 25000 }],
  } });
  actions.book.mockResolvedValue({ success: true, status: 'booked' });
});
afterEach(cleanup);
describe('sandbox booking confirmation', () => {
  it('keeps gate-off controls disabled', () => {
    render(<SandboxBookingPanel orderId={1} enabled={false} booking={null} />);
    expect(screen.getByRole('button', { name: 'Tinjau snapshot booking' })).toBeDisabled();
    expect(actions.preview).not.toHaveBeenCalled();
  });
  it('requires a successful review and explicit checkbox before one submission', async () => {
    render(<SandboxBookingPanel orderId={1} enabled booking={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tinjau snapshot booking' }));
    const button = await screen.findByRole('button', { name: 'Konfirmasi satu booking TESTING' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Total berat: 400 gram.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(actions.book).toHaveBeenCalledTimes(1));
    expect(actions.book).toHaveBeenCalledWith(1, 'reviewed', true);
    await screen.findByText(/Hasil booking: booked/);
    expect(screen.getByRole('button', { name: 'Tinjau snapshot booking' })).toBeDisabled();
  });
  it('does not offer confirmation when readiness fails', async () => {
    actions.preview.mockResolvedValue({ success: false, error: 'Snapshot berat tidak tersedia' });
    render(<SandboxBookingPanel orderId={1} enabled booking={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tinjau snapshot booking' }));
    await screen.findByText('Snapshot berat tidak tersedia');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
  it('offers only GET reconciliation for an existing reservation', async () => {
    actions.reconcile.mockResolvedValue({ success: true, status: 'booked' });
    render(<SandboxBookingPanel orderId={1} enabled booking={{ status: 'needs_reconciliation', referenceId: 'ref', externalOrderId: null, waybillId: null, courierTrackingId: null }} />);
    expect(screen.queryByRole('button', { name: 'Tinjau snapshot booking' })).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Periksa booking lewat GET' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'external' } });
    fireEvent.click(button);
    await waitFor(() => expect(actions.reconcile).toHaveBeenCalledWith(1, 'external'));
    expect(actions.book).not.toHaveBeenCalled();
  });
});
