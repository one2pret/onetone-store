import type {
  Category, Product, User, Order, OrderItem, CartItem,
  Address, Courier, StoreSetting, Invoice, Shipping,
} from '@/lib/db/schema';

export const sampleCategory: Category = {
  id: 1,
  name: 'Elektronik',
  slug: 'elektronik',
  description: 'Produk elektronik terbaru',
  image: null,
  createdAt: new Date('2025-01-01'),
};

export const sampleCategory2: Category = {
  id: 2,
  name: 'Fashion Pria',
  slug: 'fashion-pria',
  description: 'Koleksi fashion pria',
  image: null,
  createdAt: new Date('2025-01-01'),
};

export const sampleProduct: Product = {
  id: 1,
  categoryId: 1,
  name: 'Wireless Earbuds Pro',
  slug: 'wireless-earbuds-pro',
  description: 'Earbuds nirkabel dengan kualitas suara premium',
  price: '299000.00',
  stock: 50,
  weight: 500,
  image: null,
  images: null,
  isActive: true,
  isFeatured: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const sampleProduct2: Product = {
  id: 2,
  categoryId: 1,
  name: 'Smart Watch X1',
  slug: 'smart-watch-x1',
  description: 'Jam tangan pintar multifungsi',
  price: '850000.00',
  stock: 30,
  weight: 45,
  image: null,
  images: null,
  isActive: true,
  isFeatured: false,
  createdAt: new Date('2025-01-02'),
  updatedAt: new Date('2025-01-02'),
};

export const sampleUser: User = {
  id: 2,
  name: 'John Doe',
  email: 'john@example.com',
  password: '$2a$10$hashedpassword',
  phone: '08123456789',
  address: 'Jl. Contoh No. 123, Jakarta',
  role: 'customer',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const sampleAdmin: User = {
  id: 1,
  name: 'Admin Store',
  email: 'admin@store.com',
  password: '$2a$10$hashedpassword',
  phone: '08111111111',
  address: null,
  role: 'admin',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const sampleOrder: Order = {
  id: 1,
  userId: 2,
  orderNumber: 'ORD250101ABCD',
  status: 'waiting_payment',
  subtotal: '1148000.00',
  shippingCost: '15000.00',
  total: '1163000.00',
  shippingAddress: 'Jl. Contoh No. 123, Jakarta',
  shippingPhone: '08123456789',
  shippingName: 'John Doe',
  notes: null,
  willExpiredAt: null,
  paidAt: null,
  shippingAt: null,
  deliveredAt: null,
  expiredAt: null,
  cancelledAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const sampleOrderItem: OrderItem = {
  id: 1,
  orderId: 1,
  productId: 1,
  productName: 'Wireless Earbuds Pro',
  productImage: null,
  price: '299000.00',
  quantity: 2,
  subtotal: '598000.00',
};

export const sampleCartItem: CartItem = {
  id: 1,
  userId: 2,
  productId: 1,
  quantity: 2,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const sampleAddress: Address = {
  id: 1,
  userId: 2,
  label: 'Rumah',
  recipientName: 'John Doe',
  phone: '081234567890',
  address: 'Jl. Contoh No. 123, RT 05/RW 03, Kebayoran Baru',
  detail: 'Blok A2 No. 5',
  province: 'DKI Jakarta',
  city: 'Jakarta Selatan',
  district: 'Kebayoran Baru',
  postalCode: '12120',
  latitude: '-6.2441',
  longitude: '106.7834',
  isDefault: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const sampleCourier: Courier = {
  id: 1,
  name: 'JNE',
  code: 'jne',
  isActive: true,
  createdAt: new Date('2025-01-01'),
};

export const sampleStoreSetting: StoreSetting = {
  id: 1,
  key: 'store_name',
  value: 'NextElektronik',
  updatedAt: new Date('2025-01-01'),
};

export const sampleInvoice: Invoice = {
  id: 1,
  orderId: 1,
  xenditId: 'inv_123456',
  invoiceUrl: 'https://checkout.xendit.co/inv_123456',
  paymentMethod: 'BANK_TRANSFER',
  paymentChannel: 'BCA',
  amount: '1163000.00',
  status: 'pending',
  expiredAt: new Date('2025-01-02'),
  paidAt: null,
  cancelledAt: null,
  createdAt: new Date('2025-01-01'),
};

export const sampleShipping: Shipping = {
  id: 1,
  orderId: 1,
  recipientName: 'John Doe',
  phone: '081234567890',
  address: 'Jl. Contoh No. 123, Jakarta',
  addressDetail: 'Blok A2 No. 5',
  latitude: '-6.2441',
  longitude: '106.7834',
  trackingId: 'TRK123456',
  waybillId: 'WB123456',
  courierName: 'JNE REG',
  courierCompany: 'jne',
  courierType: 'reg',
  price: '15000.00',
  estimateDays: '2-3',
  status: 'confirmed',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};
