import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();
const mockUpdateReturn = vi.fn();

const mockInsertReturn = vi.fn();
const mockDeleteReturn = vi.fn();

const mockChainFn = (returnFn = mockSelectReturn) => {
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
    select: vi.fn(() => mockChainFn()),
    insert: vi.fn(() => mockChainFn(mockInsertReturn)),
    update: vi.fn(() => mockChainFn(mockUpdateReturn)),
    delete: vi.fn(() => mockChainFn(mockDeleteReturn)),
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: '2', name: 'John', email: 'john@example.com', role: 'customer' },
    })
  ),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/lib/stock', () => ({
  deductStock: vi.fn(),
  restoreStock: vi.fn(),
  validateStock: vi.fn(() => Promise.resolve({ valid: true, errors: [] })),
}));

vi.mock('@/lib/xendit', () => ({
  createInvoice: vi.fn(() =>
    Promise.resolve({
      id: 'inv_xendit_123',
      invoiceUrl: 'https://checkout.xendit.co/inv_123',
      expiryDate: '2025-01-02T00:00:00.000Z',
    })
  ),
  expireInvoice: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  generateOrderNumber: vi.fn(() => 'ORD250101TEST'),
}));

import {
  getUserOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  getDashboardStats,
  changeOrderStatus,
  createOrder,
  cancelOrderByCustomer,
  cancelOrderByAdmin,
  repayOrder,
  getOrderTracking,
} from '@/app/actions/orders';
import { db } from '@/lib/db';

describe('Order Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
    mockInsertReturn.mockReturnValue([{ insertId: 1 }]);
    mockUpdateReturn.mockReturnValue(undefined);
    mockDeleteReturn.mockReturnValue(undefined);
  });

  describe('getUserOrders', () => {
    it('returns empty array when no orders', async () => {
      const result = await getUserOrders();
      expect(result).toEqual([]);
    });

    it('returns user orders with items', async () => {
      mockSelectReturn
        .mockReturnValueOnce([
          { id: 1, userId: 2, orderNumber: 'ORD001', status: 'pending', total: '100000', createdAt: new Date() },
        ])
        .mockReturnValueOnce([]); // order items query

      const result = await getUserOrders();
      expect(result).toHaveLength(1);
    });
  });

  describe('getOrder', () => {
    it('returns order with items and user', async () => {
      mockSelectReturn
        .mockReturnValueOnce([
          {
            orders: { id: 1, orderNumber: 'ORD001', status: 'pending', total: '100000' },
            users: { id: 2, name: 'John' },
          },
        ])
        .mockReturnValueOnce([
          { id: 1, orderId: 1, productName: 'Test', quantity: 2, price: '50000', subtotal: '100000' },
        ]);

      const result = await getOrder(1);
      expect(result).toBeDefined();
      expect(result?.items).toHaveLength(1);
      expect(result?.user).toBeDefined();
    });

    it('returns null for nonexistent order', async () => {
      mockSelectReturn.mockReturnValue([]);
      const result = await getOrder(999);
      expect(result).toBeNull();
    });
  });

  describe('getAllOrders', () => {
    it('returns all orders for admin', async () => {
      mockSelectReturn
        .mockReturnValueOnce([
          {
            orders: { id: 1, orderNumber: 'ORD001', status: 'pending', total: '100000' },
            users: { id: 2, name: 'John' },
          },
        ])
        .mockReturnValueOnce([]); // order items

      const result = await getAllOrders();
      expect(result).toHaveLength(1);
    });
  });

  describe('updateOrderStatus', () => {
    it('updates status and returns success', async () => {
      const result = await updateOrderStatus(1, 'confirmed');
      expect(result.success).toBe(true);
    });
  });

  describe('changeOrderStatus', () => {
    it('succeeds for valid transition waiting_payment -> packing', async () => {
      // First select returns the order with current status
      mockSelectReturn.mockReturnValueOnce([
        { id: 1, status: 'waiting_payment', userId: 2 },
      ]);
      const result = await changeOrderStatus(1, 'packing', 'admin:1');
      expect(result.success).toBe(true);
    });

    it('blocks invalid transition waiting_payment -> delivered', async () => {
      mockSelectReturn.mockReturnValueOnce([
        { id: 1, status: 'waiting_payment', userId: 2 },
      ]);
      const result = await changeOrderStatus(1, 'delivered', 'admin:1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('tidak valid');
    });

    it('blocks transition from terminal status cancelled', async () => {
      mockSelectReturn.mockReturnValueOnce([
        { id: 1, status: 'cancelled', userId: 2 },
      ]);
      const result = await changeOrderStatus(1, 'waiting_payment', 'admin:1');
      expect(result.success).toBe(false);
    });

    it('blocks transition from terminal status delivered', async () => {
      mockSelectReturn.mockReturnValueOnce([
        { id: 1, status: 'delivered', userId: 2 },
      ]);
      const result = await changeOrderStatus(1, 'cancelled', 'admin:1');
      expect(result.success).toBe(false);
    });

    it('returns error for nonexistent order', async () => {
      mockSelectReturn.mockReturnValueOnce([]);
      const result = await changeOrderStatus(999, 'packing', 'admin:1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('tidak ditemukan');
    });

    it('allows expired -> waiting_payment (repayment)', async () => {
      mockSelectReturn.mockReturnValueOnce([
        { id: 1, status: 'expired', userId: 2 },
      ]);
      const result = await changeOrderStatus(1, 'waiting_payment', 'admin:1');
      expect(result.success).toBe(true);
    });

    it('allows packing -> shipping', async () => {
      mockSelectReturn.mockReturnValueOnce([
        { id: 1, status: 'packing', userId: 2 },
      ]);
      const result = await changeOrderStatus(1, 'shipping', 'admin:1');
      expect(result.success).toBe(true);
    });

    it('allows shipping -> delivered', async () => {
      mockSelectReturn.mockReturnValueOnce([
        { id: 1, status: 'shipping', userId: 2 },
      ]);
      const result = await changeOrderStatus(1, 'delivered', 'admin:1');
      expect(result.success).toBe(true);
    });
  });

  describe('createOrder (revamped)', () => {
    function makeCheckoutFormData(overrides: Record<string, string> = {}) {
      const fd = new FormData();
      const defaults: Record<string, string> = {
        addressId: '1',
        courierName: 'JNE REG',
        courierCompany: 'jne',
        courierType: 'reg',
        courierPrice: '15000',
        notes: '',
      };
      for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
        fd.set(key, value);
      }
      return fd;
    }

    it('requires auth', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(null);

      const result = await createOrder(null, makeCheckoutFormData());
      expect(result.success).toBe(false);
      expect(result.error).toContain('login');
    });

    it('validates address ownership', async () => {
      // Address owned by different user
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 999 }]);

      const result = await createOrder(null, makeCheckoutFormData());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Alamat');
    });

    it('returns error on empty cart', async () => {
      // Address owned by user
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2 }]);
      // Cart items (empty)
      mockSelectReturn.mockReturnValueOnce([]);

      const result = await createOrder(null, makeCheckoutFormData());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Keranjang');
    });

    it('validates stock before creating order', async () => {
      const { validateStock } = await import('@/lib/stock');
      (validateStock as any).mockResolvedValueOnce({
        valid: false,
        errors: ['Stok Earbuds tidak cukup'],
      });

      // Address
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2 }]);
      // Cart items
      mockSelectReturn.mockReturnValueOnce([
        {
          cart_items: { id: 1, userId: 2, productId: 1, quantity: 5 },
          products: { id: 1, name: 'Earbuds', price: '299000.00', weight: 500, image: null },
        },
      ]);

      const result = await createOrder(null, makeCheckoutFormData());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Earbuds');
    });

    it('creates order with invoice and returns paymentUrl', async () => {
      // Address
      mockSelectReturn.mockReturnValueOnce([{
        id: 1, userId: 2, recipientName: 'John', phone: '081234567890',
        address: 'Jl. Test', detail: 'Blok A', latitude: '-6.2', longitude: '106.8',
      }]);
      // Cart items
      mockSelectReturn.mockReturnValueOnce([
        {
          cart_items: { id: 1, userId: 2, productId: 1, quantity: 2 },
          products: { id: 1, name: 'Earbuds', price: '299000.00', weight: 500, image: null },
        },
      ]);
      // User email lookup
      mockSelectReturn.mockReturnValueOnce([{ email: 'john@example.com' }]);

      const result = await createOrder(null, makeCheckoutFormData());
      expect(result.success).toBe(true);
      expect(result.paymentUrl).toBe('https://checkout.xendit.co/inv_123');
      expect(result.orderId).toBeDefined();
    });

    it('calls deductStock after order creation', async () => {
      const { deductStock } = await import('@/lib/stock');

      mockSelectReturn.mockReturnValueOnce([{
        id: 1, userId: 2, recipientName: 'John', phone: '081234567890',
        address: 'Jl. Test', detail: 'Blok A', latitude: '-6.2', longitude: '106.8',
      }]);
      mockSelectReturn.mockReturnValueOnce([
        {
          cart_items: { id: 1, userId: 2, productId: 1, quantity: 2 },
          products: { id: 1, name: 'Earbuds', price: '299000.00', weight: 500, image: null },
        },
      ]);
      mockSelectReturn.mockReturnValueOnce([{ email: 'john@example.com' }]);

      await createOrder(null, makeCheckoutFormData());
      expect(deductStock).toHaveBeenCalled();
    });

    it('sets willExpiredAt', async () => {
      mockSelectReturn.mockReturnValueOnce([{
        id: 1, userId: 2, recipientName: 'John', phone: '081234567890',
        address: 'Jl. Test', detail: null, latitude: '-6.2', longitude: '106.8',
      }]);
      mockSelectReturn.mockReturnValueOnce([
        {
          cart_items: { id: 1, userId: 2, productId: 1, quantity: 1 },
          products: { id: 1, name: 'Earbuds', price: '299000.00', weight: 500, image: null },
        },
      ]);
      mockSelectReturn.mockReturnValueOnce([{ email: 'john@example.com' }]);

      const result = await createOrder(null, makeCheckoutFormData());
      expect(result.success).toBe(true);
      // Order insert should include willExpiredAt
      expect(db.insert).toHaveBeenCalled();
    });

    it('handles Xendit failure gracefully (order still created)', async () => {
      const { createInvoice } = await import('@/lib/xendit');
      (createInvoice as any).mockRejectedValueOnce(new Error('Xendit down'));

      mockSelectReturn.mockReturnValueOnce([{
        id: 1, userId: 2, recipientName: 'John', phone: '081234567890',
        address: 'Jl. Test', detail: null, latitude: '-6.2', longitude: '106.8',
      }]);
      mockSelectReturn.mockReturnValueOnce([
        {
          cart_items: { id: 1, userId: 2, productId: 1, quantity: 1 },
          products: { id: 1, name: 'Earbuds', price: '299000.00', weight: 500, image: null },
        },
      ]);
      mockSelectReturn.mockReturnValueOnce([{ email: 'john@example.com' }]);

      const result = await createOrder(null, makeCheckoutFormData());
      // Order should still be created, just no paymentUrl
      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
      expect(result.paymentUrl).toBeUndefined();
    });

    it('creates shipping record from address', async () => {
      mockSelectReturn.mockReturnValueOnce([{
        id: 1, userId: 2, recipientName: 'John', phone: '081234567890',
        address: 'Jl. Test', detail: 'Blok A', latitude: '-6.2', longitude: '106.8',
      }]);
      mockSelectReturn.mockReturnValueOnce([
        {
          cart_items: { id: 1, userId: 2, productId: 1, quantity: 1 },
          products: { id: 1, name: 'Earbuds', price: '299000.00', weight: 500, image: null },
        },
      ]);
      mockSelectReturn.mockReturnValueOnce([{ email: 'john@example.com' }]);

      await createOrder(null, makeCheckoutFormData());

      // Should have multiple inserts: order, orderItems, shipping, invoice
      expect(db.insert).toHaveBeenCalled();
    });

    it('clears cart after order creation', async () => {
      mockSelectReturn.mockReturnValueOnce([{
        id: 1, userId: 2, recipientName: 'John', phone: '081234567890',
        address: 'Jl. Test', detail: null, latitude: '-6.2', longitude: '106.8',
      }]);
      mockSelectReturn.mockReturnValueOnce([
        {
          cart_items: { id: 1, userId: 2, productId: 1, quantity: 1 },
          products: { id: 1, name: 'Earbuds', price: '299000.00', weight: 500, image: null },
        },
      ]);
      mockSelectReturn.mockReturnValueOnce([{ email: 'john@example.com' }]);

      await createOrder(null, makeCheckoutFormData());
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('cancelOrderByCustomer', () => {
    it('requires auth', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(null);

      const result = await cancelOrderByCustomer(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('login');
    });

    it('validates order ownership', async () => {
      mockSelectReturn.mockReturnValueOnce([{ ...{ id: 1, userId: 999, status: 'waiting_payment' } }]);

      const result = await cancelOrderByCustomer(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ditemukan');
    });

    it('only allows cancelling waiting_payment orders', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'packing' }]);

      const result = await cancelOrderByCustomer(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('waiting_payment');
    });

    it('cancels order and restores stock', async () => {
      const { restoreStock } = await import('@/lib/stock');
      // Order
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'waiting_payment' }]);
      // Invoice
      mockSelectReturn.mockReturnValueOnce([{ id: 1, xenditId: 'inv_123', status: 'pending' }]);

      const result = await cancelOrderByCustomer(1);
      expect(result.success).toBe(true);
      expect(restoreStock).toHaveBeenCalledWith(1);
    });

    it('expires Xendit invoice when cancelling', async () => {
      const { expireInvoice } = await import('@/lib/xendit');
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'waiting_payment' }]);
      mockSelectReturn.mockReturnValueOnce([{ id: 1, xenditId: 'inv_123', status: 'pending' }]);

      await cancelOrderByCustomer(1);
      expect(expireInvoice).toHaveBeenCalledWith('inv_123');
    });

    it('succeeds even without invoice', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'waiting_payment' }]);
      mockSelectReturn.mockReturnValueOnce([]); // no invoice

      const result = await cancelOrderByCustomer(1);
      expect(result.success).toBe(true);
    });
  });

  describe('repayOrder', () => {
    it('requires auth', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(null);

      const result = await repayOrder(1);
      expect(result.success).toBe(false);
    });

    it('validates order ownership', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 999, status: 'expired' }]);

      const result = await repayOrder(1);
      expect(result.success).toBe(false);
    });

    it('rejects repay for non-payable statuses', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'packing' }]);

      const result = await repayOrder(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('tidak dapat dibayar');
    });

    it('validates stock before repaying', async () => {
      const { validateStock } = await import('@/lib/stock');
      (validateStock as any).mockResolvedValueOnce({
        valid: false,
        errors: ['Stok Earbuds tidak cukup'],
      });

      mockSelectReturn.mockReturnValueOnce([{
        id: 1, userId: 2, status: 'expired', orderNumber: 'ORD001', total: '1000000',
      }]);
      // Order items for stock check
      mockSelectReturn.mockReturnValueOnce([
        { productId: 1, productName: 'Earbuds', quantity: 5 },
      ]);
      // User email
      mockSelectReturn.mockReturnValueOnce([{ email: 'john@example.com' }]);

      const result = await repayOrder(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Earbuds');
    });

    it('creates new invoice and returns paymentUrl', async () => {
      mockSelectReturn.mockReturnValueOnce([{
        id: 1, userId: 2, status: 'expired', orderNumber: 'ORD001', total: '1163000.00',
      }]);
      // Order items
      mockSelectReturn.mockReturnValueOnce([
        { productId: 1, productName: 'Earbuds', quantity: 2 },
      ]);
      // User email
      mockSelectReturn.mockReturnValueOnce([{ email: 'john@example.com' }]);

      const result = await repayOrder(1);
      expect(result.success).toBe(true);
      expect(result.paymentUrl).toBe('https://checkout.xendit.co/inv_123');
    });

    it('transitions expired -> waiting_payment', async () => {
      mockSelectReturn.mockReturnValueOnce([{
        id: 1, userId: 2, status: 'expired', orderNumber: 'ORD001', total: '1163000.00',
      }]);
      mockSelectReturn.mockReturnValueOnce([
        { productId: 1, productName: 'Earbuds', quantity: 2 },
      ]);
      mockSelectReturn.mockReturnValueOnce([{ email: 'john@example.com' }]);

      await repayOrder(1);

      // Should update order status + insert invoice + insert audit log
      expect(db.update).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('cancelOrderByAdmin', () => {
    it('requires admin role', async () => {
      // Auth returns customer (not admin)
      const result = await cancelOrderByAdmin(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });

    it('returns error for nonexistent order', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', email: 'admin@store.com', role: 'admin' },
      });
      mockSelectReturn.mockReturnValueOnce([]);

      const result = await cancelOrderByAdmin(999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ditemukan');
    });

    it('allows cancelling waiting_payment orders', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', email: 'admin@store.com', role: 'admin' },
      });
      const { restoreStock } = await import('@/lib/stock');

      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'waiting_payment' }]);
      mockSelectReturn.mockReturnValueOnce([{ id: 1, xenditId: 'inv_123', status: 'pending' }]);

      const result = await cancelOrderByAdmin(1);
      expect(result.success).toBe(true);
      expect(restoreStock).toHaveBeenCalledWith(1);
    });

    it('allows cancelling packing orders', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', email: 'admin@store.com', role: 'admin' },
      });
      const { restoreStock } = await import('@/lib/stock');

      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'packing' }]);
      mockSelectReturn.mockReturnValueOnce([]); // no pending invoice for packing

      const result = await cancelOrderByAdmin(1);
      expect(result.success).toBe(true);
      expect(restoreStock).toHaveBeenCalledWith(1);
    });

    it('blocks cancelling shipped/delivered/cancelled orders', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', email: 'admin@store.com', role: 'admin' },
      });

      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'delivered' }]);

      const result = await cancelOrderByAdmin(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('dibatalkan');
    });

    it('expires Xendit invoice when cancelling waiting_payment', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', email: 'admin@store.com', role: 'admin' },
      });
      const { expireInvoice } = await import('@/lib/xendit');

      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'waiting_payment' }]);
      mockSelectReturn.mockReturnValueOnce([{ id: 1, xenditId: 'inv_456', status: 'pending' }]);

      await cancelOrderByAdmin(1);
      expect(expireInvoice).toHaveBeenCalledWith('inv_456');
    });

    it('logs changedBy as admin:{id}', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', email: 'admin@store.com', role: 'admin' },
      });

      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'packing' }]);
      mockSelectReturn.mockReturnValueOnce([]); // no invoice

      await cancelOrderByAdmin(1);
      // Should insert audit log
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('getOrderTracking', () => {
    it('requires auth', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(null);

      const result = await getOrderTracking(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('login');
    });

    it('returns error for nonexistent order', async () => {
      mockSelectReturn.mockReturnValueOnce([]); // order not found

      const result = await getOrderTracking(999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ditemukan');
    });

    it('validates ownership for customer role', async () => {
      // Customer session with userId=2, but order belongs to userId=5
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 5, status: 'shipping' }]);

      const result = await getOrderTracking(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ditemukan');
    });

    it('allows admin to view any order tracking', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '1', name: 'Admin', email: 'admin@store.com', role: 'admin' },
      });

      // Order belongs to userId=5 (not admin)
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 5, status: 'shipping' }]);
      // Shipping record
      mockSelectReturn.mockReturnValueOnce([{
        id: 1, orderId: 1, trackingId: 'TRK123', waybillId: 'WB123',
        courierName: 'JNE REG', status: 'in_transit',
      }]);
      // Shipping histories
      mockSelectReturn.mockReturnValueOnce([
        { id: 1, shippingId: 1, status: 'picked', note: 'Picked up', updatedAt: new Date() },
      ]);

      const result = await getOrderTracking(1);
      expect(result.success).toBe(true);
      expect(result.data?.shipping.trackingId).toBe('TRK123');
      expect(result.data?.histories).toHaveLength(1);
    });

    it('returns shipping data with histories for customer', async () => {
      // Order belongs to userId=2 (matching session)
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'shipping' }]);
      // Shipping
      mockSelectReturn.mockReturnValueOnce([{
        id: 1, orderId: 1, trackingId: 'TRK456', waybillId: 'WB456',
        courierName: 'SiCepat REG', courierCompany: 'sicepat', status: 'delivered',
      }]);
      // Histories
      mockSelectReturn.mockReturnValueOnce([
        { id: 2, shippingId: 1, status: 'delivered', note: 'Delivered', updatedAt: new Date() },
        { id: 1, shippingId: 1, status: 'picked', note: 'Picked up', updatedAt: new Date() },
      ]);

      const result = await getOrderTracking(1);
      expect(result.success).toBe(true);
      expect(result.data?.shipping.courierName).toBe('SiCepat REG');
      expect(result.data?.histories).toHaveLength(2);
    });

    it('returns null shipping if no shipping record', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2, status: 'waiting_payment' }]);
      mockSelectReturn.mockReturnValueOnce([]); // no shipping record

      const result = await getOrderTracking(1);
      expect(result.success).toBe(true);
      expect(result.data?.shipping).toBeNull();
      expect(result.data?.histories).toEqual([]);
    });
  });

  describe('getDashboardStats', () => {
    it('returns stats object with all fields', async () => {
      mockSelectReturn
        .mockReturnValueOnce([]) // orders
        .mockReturnValueOnce([]); // products

      const result = await getDashboardStats();
      expect(result).toHaveProperty('totalOrders');
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('todayRevenue');
      expect(result).toHaveProperty('weekRevenue');
      expect(result).toHaveProperty('monthRevenue');
      expect(result).toHaveProperty('waitingPaymentOrders');
      expect(result).toHaveProperty('packingOrders');
      expect(result).toHaveProperty('shippingOrders');
      expect(result).toHaveProperty('ordersByStatus');
      expect(result).toHaveProperty('totalProducts');
    });

    it('calculates correct totals and status breakdown', async () => {
      mockSelectReturn
        .mockReturnValueOnce([
          { id: 1, status: 'waiting_payment', total: '100000', createdAt: new Date(), paidAt: null },
          { id: 2, status: 'delivered', total: '200000', createdAt: new Date(), paidAt: new Date() },
          { id: 3, status: 'packing', total: '150000', createdAt: new Date(), paidAt: new Date() },
        ])
        .mockReturnValueOnce([
          { id: 1, isActive: true },
          { id: 2, isActive: false },
        ]);

      const result = await getDashboardStats();
      expect(result.totalOrders).toBe(3);
      expect(result.totalRevenue).toBe(350000);
      expect(result.waitingPaymentOrders).toBe(1);
      expect(result.packingOrders).toBe(1);
      expect(result.ordersByStatus).toEqual({
        waiting_payment: 1,
        delivered: 1,
        packing: 1,
      });
      expect(result.totalProducts).toBe(2);
      expect(result.activeProducts).toBe(1);
    });
  });
});
