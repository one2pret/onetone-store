import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv('BITSHIP_API_URL', 'https://api.biteship.com');
  vi.stubEnv('BITSHIP_API_KEY', 'test_bitship_key');
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

import { getShippingRates, createShipment, getTracking } from '@/lib/bitship';
import type { BitshipRateRequest, BitshipShipmentRequest } from '@/lib/bitship';

describe('Bitship API Client', () => {
  describe('getShippingRates', () => {
    const rateRequest: BitshipRateRequest = {
      origin_latitude: '-6.200000',
      origin_longitude: '106.816666',
      destination_latitude: '-6.2441',
      destination_longitude: '106.7834',
      couriers: 'jne,sicepat',
      items: [{ name: 'Earbuds', weight: 500, quantity: 2, value: 299000 }],
    };

    it('sends correct headers and URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ pricing: [] }),
      });

      await getShippingRates(rateRequest);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.biteship.com/v1/rates/couriers',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_bitship_key',
          },
        }),
      );
    });

    it('sends correct request body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ pricing: [] }),
      });

      await getShippingRates(rateRequest);

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.origin_latitude).toBe('-6.200000');
      expect(body.couriers).toBe('jne,sicepat');
      expect(body.items).toHaveLength(1);
    });

    it('returns parsed rates on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            pricing: [
              {
                courier_name: 'JNE',
                courier_code: 'jne',
                courier_service_name: 'REG',
                courier_service_code: 'reg',
                type: 'regular',
                price: 15000,
                duration: '2-3',
              },
              {
                courier_name: 'SiCepat',
                courier_code: 'sicepat',
                courier_service_name: 'BEST',
                courier_service_code: 'best',
                type: 'express',
                price: 25000,
                duration: '1-2',
              },
            ],
          }),
      });

      const rates = await getShippingRates(rateRequest);
      expect(rates).toHaveLength(2);
      expect(rates[0].courier_name).toBe('JNE');
      expect(rates[0].price).toBe(15000);
      expect(rates[1].type).toBe('express');
    });

    it('returns empty array when no rates', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ pricing: [] }),
      });

      const rates = await getShippingRates(rateRequest);
      expect(rates).toEqual([]);
    });

    it('throws on API error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid request' }),
      });

      await expect(getShippingRates(rateRequest)).rejects.toThrow('Bitship API error');
    });

    it('throws on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(getShippingRates(rateRequest)).rejects.toThrow('Network error');
    });
  });

  describe('createShipment', () => {
    const shipmentRequest: BitshipShipmentRequest = {
      origin_contact_name: 'Store Admin',
      origin_contact_phone: '08111111111',
      origin_address: 'Jl. Store No. 1',
      origin_coordinate: { latitude: -6.2, longitude: 106.816 },
      destination_contact_name: 'John Doe',
      destination_contact_phone: '08123456789',
      destination_address: 'Jl. Contoh No. 123',
      destination_coordinate: { latitude: -6.244, longitude: 106.783 },
      courier_company: 'jne',
      courier_type: 'reg',
      delivery_type: 'later',
      items: [{ name: 'Earbuds', weight: 500, quantity: 2, value: 299000 }],
    };

    it('sends correct URL and method', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'ship_123', courier: { waybill_id: 'WB001' } }),
      });

      await createShipment(shipmentRequest);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.biteship.com/v1/orders',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns shipment id and waybill_id on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ id: 'ship_123', courier: { waybill_id: 'WB001' } }),
      });

      const result = await createShipment(shipmentRequest);
      expect(result.id).toBe('ship_123');
      expect(result.waybill_id).toBe('WB001');
    });

    it('throws on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ error: 'Unprocessable' }),
      });

      await expect(createShipment(shipmentRequest)).rejects.toThrow('Bitship API error');
    });
  });

  describe('getTracking', () => {
    it('sends correct URL with tracking ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'ship_123',
            courier: { waybill_id: 'WB001' },
            status: 'delivered',
            courier_tracking_history: [],
          }),
      });

      await getTracking('ship_123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.biteship.com/v1/orders/ship_123',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns tracking info on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'ship_123',
            courier: { waybill_id: 'WB001' },
            status: 'delivered',
            courier_tracking_history: [
              { status: 'picked', note: 'Picked up', updated_at: '2025-01-01T12:00:00Z' },
            ],
          }),
      });

      const result = await getTracking('ship_123');
      expect(result.id).toBe('ship_123');
      expect(result.waybill_id).toBe('WB001');
      expect(result.status).toBe('delivered');
      expect(result.histories).toHaveLength(1);
    });

    it('throws on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      await expect(getTracking('invalid')).rejects.toThrow('Bitship API error');
    });

    it('throws on missing API key', async () => {
      vi.stubEnv('BITSHIP_API_KEY', '');

      await expect(getTracking('ship_123')).rejects.toThrow('BITSHIP_API_KEY');
    });
  });
});
