import { describe, expect, it } from 'vitest';
import { canViewSandboxBooking, sandboxBookingSummary } from './sandbox-booking-summary';

describe('read-only Biteship sandbox booking visibility', () => {
  it('shows SBX orders only on staging/test even when the POST booking gate is disabled', () => {
    expect(canViewSandboxBooking('SBX-test-order', { APP_ENV: 'staging' })).toBe(true);
    expect(canViewSandboxBooking('SBX-test-order', { APP_ENV: 'test' })).toBe(true);
    expect(canViewSandboxBooking('SBX-test-order', { APP_ENV: 'production' })).toBe(false);
    expect(canViewSandboxBooking('SBX-test-order', { APP_ENV: undefined })).toBe(false);
    expect(canViewSandboxBooking('ORD-normal', { APP_ENV: 'staging' })).toBe(false);
  });

  it('exposes a minimal booked TEST summary without any snapshot, contact or provider ID', () => {
    const databaseRow = {
      mode: 'sandbox', status: 'booked', waybillId: 'WYB-TEST',
      snapshot: '{"destination_contact_phone":"secret"}',
      externalOrderId: 'sensitive-provider-id',
      courierTrackingId: 'internal-tracking',
    };
    const summary = sandboxBookingSummary(databaseRow);
    expect(summary).toEqual({ mode: 'sandbox', status: 'booked', waybillId: 'WYB-TEST' });
    expect(JSON.stringify(summary)).not.toContain('secret');
    expect(JSON.stringify(summary)).not.toContain('sensitive-provider-id');
  });

  it('does not expose a waybill for ambiguous, rejected or invalid modes', () => {
    expect(sandboxBookingSummary({ mode: 'sandbox', status: 'needs_reconciliation', waybillId: 'unverified' }))
      .toEqual({ mode: 'sandbox', status: 'needs_reconciliation', waybillId: null });
    expect(sandboxBookingSummary({ mode: 'sandbox', status: 'rejected', waybillId: 'unverified' }))
      .toEqual({ mode: 'sandbox', status: 'rejected', waybillId: null });
    expect(sandboxBookingSummary({ mode: 'live', status: 'booked', waybillId: 'WB' })).toBeNull();
    expect(sandboxBookingSummary({ mode: 'sandbox', status: 'unknown', waybillId: null })).toBeNull();
    expect(sandboxBookingSummary(null)).toBeNull();
  });
});
