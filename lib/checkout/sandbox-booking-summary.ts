import { isSandboxOrder } from './sandbox-legacy-guard';

// Separate from BITESHIP_SANDBOX_BOOKING_ENABLED: turning off POST must not
// hide a previously recorded TEST booking from its rightful customer.
export function canViewSandboxBooking(orderNumber: string, env: Pick<NodeJS.ProcessEnv, 'APP_ENV'> = process.env): boolean {
  return ['staging', 'test'].includes(env.APP_ENV ?? '') && isSandboxOrder(orderNumber);
}

export type SandboxBookingSummary = {
  mode: 'sandbox';
  status: 'booked' | 'needs_reconciliation' | 'rejected';
  waybillId: string | null;
};

export function sandboxBookingSummary(booking: {
  mode: string;
  status: string;
  waybillId: string | null;
} | null | undefined): SandboxBookingSummary | null {
  if (!booking || booking.mode !== 'sandbox' ||
      (booking.status !== 'booked' && booking.status !== 'needs_reconciliation' && booking.status !== 'rejected')) {
    return null;
  }
  return {
    mode: 'sandbox',
    status: booking.status,
    // Never display an unverified waybill as a confirmed TEST booking.
    waybillId: booking.status === 'booked' ? booking.waybillId : null,
  };
}
