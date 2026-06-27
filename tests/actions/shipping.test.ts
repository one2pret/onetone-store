import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sampleAddress, sampleStoreSetting, sampleCourier,
  sampleProduct, sampleProduct2, sampleCartItem,
  sampleOrder, sampleShipping, sampleAdmin,
} from '../helpers/fixtures';

const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();
const mockUpdateReturn = vi.fn();

const mockChain = (returnFn = mockSelectReturn) => {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(returnFn());
  chain.catch = () => chain;
  return chain;
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => mockChain()),
    insert: vi.fn(() => mockChain(mockInsertReturn)),
    update: vi.fn(() => mockChain(mockUpdateReturn)),
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: '2', name: 'John', email: 'john@example.com', role: 'customer' },
    })
  ),
}));

vi.mock('@/lib/bitship', () => ({
  getShippingRates: vi.fn(),
  createShipment: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { calculateShippingRates, sendOrderToBitship } from '@/app/actions/shipping';
import { getShippingRates, createShipment } from '@/lib/bitship';
import { db } from '@/lib/db';

describe('Shipping Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
    mockInsertReturn.mockReturnValue([{ insertId: 1 }]);
    mockUpdateReturn.mockReturnValue(undefined);
  });

  describe('calculateShippingRates', () => {
    it('requires authentication', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(null);

      const result = await calculateShippingRates(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('login');
    });

    it('validates address ownership', async () => {
      // Address query returns address owned by different user
      mockSelectReturn.mockReturnValueOnce([{ ...sampleAddress, userId: 999 }]);

      const result = await calculateShippingRates(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Alamat');
    });

    it('returns error when address not found', async () => {
      mockSelectReturn.mockReturnValueOnce([]);

      const result = await calculateShippingRates(999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Alamat');
    });

    it('returns error when store origin not configured', async () => {
      // Address
      mockSelectReturn.mockReturnValueOnce([sampleAddress]);
      // Store settings (no origin)
      mockSelectReturn.mockReturnValueOnce([]);

      const result = await calculateShippingRates(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('toko');
    });

    it('returns error when no active couriers', async () => {
      // Address
      mockSelectReturn.mockReturnValueOnce([sampleAddress]);
      // Store settings (origin configured)
      mockSelectReturn.mockReturnValueOnce([
        { key: 'store_latitude', value: '-6.200000' },
        { key: 'store_longitude', value: '106.816666' },
      ]);
      // Active couriers
      mockSelectReturn.mockReturnValueOnce([]);

      const result = await calculateShippingRates(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('kurir');
    });

    it('returns error when cart is empty', async () => {
      // Address
      mockSelectReturn.mockReturnValueOnce([sampleAddress]);
      // Store settings
      mockSelectReturn.mockReturnValueOnce([
        { key: 'store_latitude', value: '-6.200000' },
        { key: 'store_longitude', value: '106.816666' },
      ]);
      // Active couriers
      mockSelectReturn.mockReturnValueOnce([sampleCourier]);
      // Cart items (empty)
      mockSelectReturn.mockReturnValueOnce([]);

      const result = await calculateShippingRates(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Keranjang');
    });

    it('calculates correct weight and calls Bitship', async () => {
      // Address
      mockSelectReturn.mockReturnValueOnce([sampleAddress]);
      // Store settings
      mockSelectReturn.mockReturnValueOnce([
        { key: 'store_latitude', value: '-6.200000' },
        { key: 'store_longitude', value: '106.816666' },
      ]);
      // Active couriers
      mockSelectReturn.mockReturnValueOnce([sampleCourier, { ...sampleCourier, id: 2, code: 'sicepat' }]);
      // Cart items with products
      mockSelectReturn.mockReturnValueOnce([
        { cart_items: { ...sampleCartItem, quantity: 2 }, products: sampleProduct },
        { cart_items: { ...sampleCartItem, id: 2, productId: 2, quantity: 1 }, products: sampleProduct2 },
      ]);

      (getShippingRates as any).mockResolvedValue([
        { courier_name: 'JNE', courier_code: 'jne', courier_service_name: 'REG', courier_service_code: 'reg', type: 'regular', price: 15000, duration: '2-3' },
        { courier_name: 'JNE', courier_code: 'jne', courier_service_name: 'YES', courier_service_code: 'yes', type: 'express', price: 25000, duration: '1' },
      ]);

      const result = await calculateShippingRates(1);
      expect(result.success).toBe(true);
      expect(getShippingRates).toHaveBeenCalledWith(
        expect.objectContaining({
          origin_latitude: '-6.200000',
          couriers: 'jne,sicepat',
        }),
      );
      expect(result.data).toBeDefined();
    });

    it('handles Bitship API error gracefully', async () => {
      // Address
      mockSelectReturn.mockReturnValueOnce([sampleAddress]);
      // Store settings
      mockSelectReturn.mockReturnValueOnce([
        { key: 'store_latitude', value: '-6.200000' },
        { key: 'store_longitude', value: '106.816666' },
      ]);
      // Active couriers
      mockSelectReturn.mockReturnValueOnce([sampleCourier]);
      // Cart items
      mockSelectReturn.mockReturnValueOnce([
        { cart_items: sampleCartItem, products: sampleProduct },
      ]);

      (getShippingRates as any).mockRejectedValue(new Error('Bitship API error'));

      const result = await calculateShippingRates(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ongkir');
    });

    it('groups rates by type', async () => {
      // Address
      mockSelectReturn.mockReturnValueOnce([sampleAddress]);
      // Store settings
      mockSelectReturn.mockReturnValueOnce([
        { key: 'store_latitude', value: '-6.200000' },
        { key: 'store_longitude', value: '106.816666' },
      ]);
      // Active couriers
      mockSelectReturn.mockReturnValueOnce([sampleCourier]);
      // Cart items
      mockSelectReturn.mockReturnValueOnce([
        { cart_items: sampleCartItem, products: sampleProduct },
      ]);

      (getShippingRates as any).mockResolvedValue([
        { courier_name: 'JNE', courier_code: 'jne', courier_service_name: 'REG', courier_service_code: 'reg', type: 'regular', price: 15000, duration: '2-3' },
        { courier_name: 'JNE', courier_code: 'jne', courier_service_name: 'YES', courier_service_code: 'yes', type: 'express', price: 25000, duration: '1' },
        { courier_name: 'JNE', courier_code: 'jne', courier_service_name: 'OKE', courier_service_code: 'oke', type: 'economy', price: 10000, duration: '3-5' },
      ]);

      const result = await calculateShippingRates(1);
      expect(result.success).toBe(true);
      expect(result.data?.express).toHaveLength(1);
      expect(result.data?.regular).toHaveLength(1);
      expect(result.data?.economy).toHaveLength(1);
    });
  });

  describe('sendOrderToBitship', () => {
    it('requires admin role', async () => {
      // Customer session is mocked by default
      const result = await sendOrderToBitship(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });

    it('returns error when order not found', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', role: 'admin' },
      });
      mockSelectReturn.mockReturnValueOnce([]); // order not found

      const result = await sendOrderToBitship(999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('tidak ditemukan');
    });

    it('returns error when order status is not packing', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', role: 'admin' },
      });
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'waiting_payment' }]);

      const result = await sendOrderToBitship(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('packing');
    });

    it('returns error when no shipping record', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', role: 'admin' },
      });
      // Order in packing status
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'packing' }]);
      // No shipping record
      mockSelectReturn.mockReturnValueOnce([]);
      // Store settings
      mockSelectReturn.mockReturnValueOnce([]);

      const result = await sendOrderToBitship(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('shipping');
    });

    it('succeeds and stores tracking IDs', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', role: 'admin' },
      });
      // Order in packing
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'packing' }]);
      // Shipping record (no trackingId yet)
      mockSelectReturn.mockReturnValueOnce([{ ...sampleShipping, trackingId: null, waybillId: null }]);
      // Store settings
      mockSelectReturn.mockReturnValueOnce([
        { key: 'store_name', value: 'NextElektronik' },
        { key: 'store_phone', value: '08111111111' },
        { key: 'store_address', value: 'Jl. Store No. 1' },
        { key: 'store_latitude', value: '-6.200000' },
        { key: 'store_longitude', value: '106.816666' },
      ]);
      // Order items for Bitship
      mockSelectReturn.mockReturnValueOnce([
        { productName: 'Earbuds', quantity: 2, price: '299000.00', productId: 1 },
      ]);
      // Product weight
      mockSelectReturn.mockReturnValueOnce([{ weight: 500 }]);

      (createShipment as any).mockResolvedValue({
        id: 'bitship_order_123',
        waybill_id: 'WB001',
      });

      const result = await sendOrderToBitship(1);
      expect(result.success).toBe(true);
      expect(createShipment).toHaveBeenCalled();
      // Should update shipping with tracking IDs
      expect(db.update).toHaveBeenCalled();
    });

    it('skips Bitship call when trackingId already exists (idempotent)', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', role: 'admin' },
      });
      // Order in packing
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'packing' }]);
      // Shipping record already has trackingId
      mockSelectReturn.mockReturnValueOnce([sampleShipping]); // has trackingId: 'TRK123456'

      const result = await sendOrderToBitship(1);
      expect(result.success).toBe(true);
      expect(createShipment).not.toHaveBeenCalled();
    });

    it('transitions order to shipping status', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', role: 'admin' },
      });
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'packing' }]);
      mockSelectReturn.mockReturnValueOnce([{ ...sampleShipping, trackingId: null, waybillId: null }]);
      mockSelectReturn.mockReturnValueOnce([
        { key: 'store_name', value: 'NextElektronik' },
        { key: 'store_phone', value: '08111111111' },
        { key: 'store_address', value: 'Jl. Store No. 1' },
        { key: 'store_latitude', value: '-6.200000' },
        { key: 'store_longitude', value: '106.816666' },
      ]);
      mockSelectReturn.mockReturnValueOnce([
        { productName: 'Earbuds', quantity: 2, price: '299000.00', productId: 1 },
      ]);
      mockSelectReturn.mockReturnValueOnce([{ weight: 500 }]);

      (createShipment as any).mockResolvedValue({ id: 'ship_123', waybill_id: 'WB001' });

      const result = await sendOrderToBitship(1);
      expect(result.success).toBe(true);
      // Order status should be updated + shipping updated + audit log inserted
      expect(db.update).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });

    it('handles Bitship API error', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', role: 'admin' },
      });
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'packing' }]);
      mockSelectReturn.mockReturnValueOnce([{ ...sampleShipping, trackingId: null, waybillId: null }]);
      mockSelectReturn.mockReturnValueOnce([
        { key: 'store_name', value: 'NextElektronik' },
        { key: 'store_phone', value: '08111111111' },
        { key: 'store_address', value: 'Jl. Store No. 1' },
        { key: 'store_latitude', value: '-6.200000' },
        { key: 'store_longitude', value: '106.816666' },
      ]);
      mockSelectReturn.mockReturnValueOnce([
        { productName: 'Earbuds', quantity: 2, price: '299000.00', productId: 1 },
      ]);
      mockSelectReturn.mockReturnValueOnce([{ weight: 500 }]);

      (createShipment as any).mockRejectedValue(new Error('Bitship error'));

      const result = await sendOrderToBitship(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('pengiriman');
    });
  });
});
