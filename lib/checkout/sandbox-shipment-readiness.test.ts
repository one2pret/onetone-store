import { describe, expect, it } from 'vitest';
import {
  evaluateSandboxShipmentReadiness,
  isBiteshipSandboxApiKey,
  type ShipmentReadinessInput,
} from './sandbox-shipment-readiness';

const valid: ShipmentReadinessInput = {
  orderStatus: 'packing',
  invoiceStatus: 'paid',
  hasSandboxBiteshipKey: true,
  hasTracking: false,
  origin: {
    contactName: 'Store',
    contactPhone: '081234567890',
    address: 'Alamat gudang TEST',
    latitude: '-6.2', longitude: '106.8',
  },
  shipping: {
    recipientName: 'Customer',
    phone: '081234567890',
    address: 'Alamat tujuan TEST',
    latitude: '-6.91', longitude: '107.60',
    courierCompany: 'jne', courierType: 'reg',
  },
  items: [{
    name: 'Kaos', quantity: 2, unitPrice: 25000, weightGrams: 200,
  }],
};

function check(input: ShipmentReadinessInput, id: string) {
  return evaluateSandboxShipmentReadiness(input).checks.find(c => c.id === id)?.ok;
}

describe('Biteship testing credential detection', () => {
  it('accepts only a nonempty testing API key prefix', () => {
    expect(isBiteshipSandboxApiKey('biteship_test.test-token')).toBe(true);
    expect(isBiteshipSandboxApiKey('biteship_live.secret')).toBe(false);
    expect(isBiteshipSandboxApiKey('biteship_test.')).toBe(false);
    expect(isBiteshipSandboxApiKey(undefined)).toBe(false);
  });
});

describe('read-only TEST shipment readiness', () => {
  it('reports complete checklist for paid order and uses weight per unit', () => {
    const result = evaluateSandboxShipmentReadiness(valid);
    expect(result.dataComplete).toBe(true);
    expect(result.checks.every(c => c.ok)).toBe(true);
    // Two units * 200 grams; do not send 400 grams * 2 to Biteship.
    expect(result.estimatedTotalWeightGrams).toBe(400);
  });

  it('rejects pending/expired orders even with complete addresses', () => {
    expect(check({ ...valid, orderStatus: 'waiting_payment' }, 'payment')).toBe(false);
    expect(check({ ...valid, invoiceStatus: 'expired' }, 'payment')).toBe(false);
    expect(check({ ...valid, orderStatus: 'shipping' }, 'payment')).toBe(false);
  });

  it('never considers a live API key or existing shipment ready', () => {
    expect(check({ ...valid, hasSandboxBiteshipKey: false }, 'mode')).toBe(false);
    expect(check({ ...valid, hasTracking: true }, 'tracking')).toBe(false);
  });

  it('requires nonzero valid origin and destination coordinates', () => {
    expect(check({ ...valid, origin: { ...valid.origin, latitude: '0' } }, 'origin')).toBe(false);
    expect(check({ ...valid, origin: { ...valid.origin, latitude: '999' } }, 'origin')).toBe(false);
    expect(check({ ...valid, shipping: { ...valid.shipping!, longitude: '0' } }, 'destination')).toBe(false);
    expect(check({ ...valid, shipping: null }, 'destination')).toBe(false);
  });

  it('fails without courier code, package weight or item quantity', () => {
    expect(check({ ...valid, shipping: { ...valid.shipping!, courierType: '' } }, 'courier')).toBe(false);
    expect(check({ ...valid, items: [{ ...valid.items[0], weightGrams: 0 }] }, 'items')).toBe(false);
    expect(check({ ...valid, items: [{ ...valid.items[0], quantity: 0 }] }, 'items')).toBe(false);
    expect(check({ ...valid, items: [{ ...valid.items[0], unitPrice: -1 }] }, 'items')).toBe(false);
    expect(evaluateSandboxShipmentReadiness({ ...valid, items: [] }).estimatedTotalWeightGrams).toBeNull();
  });
});
