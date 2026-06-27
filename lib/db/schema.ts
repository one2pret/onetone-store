// lib/db/schema.ts
import {
  mysqlTable,
  int,
  varchar,
  decimal,
  timestamp,
  text,
  boolean,
  mysqlEnum,
} from 'drizzle-orm/mysql-core';
import { relations, InferSelectModel, InferInsertModel } from 'drizzle-orm';

// ============ USERS ============
export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  role: mysqlEnum('role', ['customer', 'admin']).default('customer'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ ADDRESSES ============
export const addresses = mysqlTable('addresses', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id).notNull(),
  label: varchar('label', { length: 100 }),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  address: text('address').notNull(),
  detail: text('detail'),
  province: varchar('province', { length: 255 }).notNull(),
  provinceId: varchar('province_id', { length: 10 }),
  city: varchar('city', { length: 255 }).notNull(),
  cityId: varchar('city_id', { length: 10 }),
  district: varchar('district', { length: 255 }).notNull(),
  districtId: varchar('district_id', { length: 10 }),
  postalCode: varchar('postal_code', { length: 10 }).notNull(),
  latitude: varchar('latitude', { length: 50 }),
  longitude: varchar('longitude', { length: 50 }),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ STORE SETTINGS ============
export const storeSettings = mysqlTable('store_settings', {
  id: int('id').primaryKey().autoincrement(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ COURIERS ============
export const couriers = mysqlTable('couriers', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============ CATEGORIES ============
export const categories = mysqlTable('categories', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  image: varchar('image', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============ PRODUCTS ============
export const products = mysqlTable('products', {
  id: int('id').primaryKey().autoincrement(),
  categoryId: int('category_id').references(() => categories.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  stock: int('stock').default(0),
  weight: int('weight').default(0), // grams
  image: varchar('image', { length: 500 }),
  images: text('images'), // JSON array of image URLs
  isActive: boolean('is_active').default(true),
  isFeatured: boolean('is_featured').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ CART ITEMS ============
export const cartItems = mysqlTable('cart_items', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id).notNull(),
  productId: int('product_id').references(() => products.id).notNull(),
  quantity: int('quantity').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ ORDERS ============
export const orders = mysqlTable('orders', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id).notNull(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  status: mysqlEnum('status', [
    'waiting_payment',
    'packing',
    'shipping',
    'delivered',
    'expired',
    'cancelled',
  ]).default('waiting_payment'),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  shippingCost: decimal('shipping_cost', { precision: 12, scale: 2 }).default('0'),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  shippingAddress: text('shipping_address').notNull(),
  shippingPhone: varchar('shipping_phone', { length: 20 }).notNull(),
  shippingName: varchar('shipping_name', { length: 255 }).notNull(),
  notes: text('notes'),
  willExpiredAt: timestamp('will_expired_at'),
  paidAt: timestamp('paid_at'),
  shippingAt: timestamp('shipping_at'),
  deliveredAt: timestamp('delivered_at'),
  expiredAt: timestamp('expired_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ ORDER ITEMS ============
export const orderItems = mysqlTable('order_items', {
  id: int('id').primaryKey().autoincrement(),
  orderId: int('order_id').references(() => orders.id).notNull(),
  productId: int('product_id').references(() => products.id),
  productName: varchar('product_name', { length: 255 }).notNull(),
  productImage: varchar('product_image', { length: 500 }),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  quantity: int('quantity').notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
});

// ============ INVOICES ============
export const invoices = mysqlTable('invoices', {
  id: int('id').primaryKey().autoincrement(),
  orderId: int('order_id').references(() => orders.id).notNull(),
  xenditId: varchar('xendit_id', { length: 255 }),
  invoiceUrl: text('invoice_url'),
  paymentMethod: varchar('payment_method', { length: 100 }),
  paymentChannel: varchar('payment_channel', { length: 100 }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum('invoice_status', ['pending', 'paid', 'expired', 'cancelled']).default('pending'),
  expiredAt: timestamp('expired_at'),
  paidAt: timestamp('paid_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============ SHIPPINGS ============
export const shippings = mysqlTable('shippings', {
  id: int('id').primaryKey().autoincrement(),
  orderId: int('order_id').references(() => orders.id).notNull(),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  address: text('address').notNull(),
  addressDetail: text('address_detail'),
  latitude: varchar('latitude', { length: 50 }),
  longitude: varchar('longitude', { length: 50 }),
  trackingId: varchar('tracking_id', { length: 255 }),
  waybillId: varchar('waybill_id', { length: 255 }),
  courierName: varchar('courier_name', { length: 255 }),
  courierCompany: varchar('courier_company', { length: 100 }),
  courierType: varchar('courier_type', { length: 100 }),
  price: decimal('price', { precision: 12, scale: 2 }),
  estimateDays: varchar('estimate_days', { length: 50 }),
  status: varchar('shipping_status', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ SHIPPING HISTORIES ============
export const shippingHistories = mysqlTable('shipping_histories', {
  id: int('id').primaryKey().autoincrement(),
  shippingId: int('shipping_id').references(() => shippings.id).notNull(),
  status: varchar('status', { length: 100 }).notNull(),
  note: text('note'),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ ORDER STATUS LOGS ============
export const orderStatusLogs = mysqlTable('order_status_logs', {
  id: int('id').primaryKey().autoincrement(),
  orderId: int('order_id').references(() => orders.id).notNull(),
  fromStatus: varchar('from_status', { length: 50 }).notNull(),
  toStatus: varchar('to_status', { length: 50 }).notNull(),
  changedBy: varchar('changed_by', { length: 100 }).notNull(), // "user:1", "admin:1", "webhook:xendit"
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============ RELATIONS ============
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  cartItems: many(cartItems),
  addresses: many(addresses),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  invoices: many(invoices),
  shippings: many(shippings),
  statusLogs: many(orderStatusLogs),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  order: one(orders, {
    fields: [invoices.orderId],
    references: [orders.id],
  }),
}));

export const shippingsRelations = relations(shippings, ({ one, many }) => ({
  order: one(orders, {
    fields: [shippings.orderId],
    references: [orders.id],
  }),
  histories: many(shippingHistories),
}));

export const shippingHistoriesRelations = relations(shippingHistories, ({ one }) => ({
  shipping: one(shippings, {
    fields: [shippingHistories.shippingId],
    references: [shippings.id],
  }),
}));

export const orderStatusLogsRelations = relations(orderStatusLogs, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusLogs.orderId],
    references: [orders.id],
  }),
}));

// ============ BANNERS ============
export const banners = mysqlTable('banners', {
  id: int('id').primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }).notNull(),
  subtitle: varchar('subtitle', { length: 500 }),
  image: varchar('image', { length: 500 }).notNull(),
  link: varchar('link', { length: 500 }),
  isActive: boolean('is_active').default(true),
  sortOrder: int('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ TYPE INFERENCE ============
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Address = InferSelectModel<typeof addresses>;
export type NewAddress = InferInsertModel<typeof addresses>;

export type StoreSetting = InferSelectModel<typeof storeSettings>;

export type Courier = InferSelectModel<typeof couriers>;

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;

export type CartItem = InferSelectModel<typeof cartItems>;
export type NewCartItem = InferInsertModel<typeof cartItems>;

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;

export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;

export type Invoice = InferSelectModel<typeof invoices>;

export type Shipping = InferSelectModel<typeof shippings>;

export type ShippingHistory = InferSelectModel<typeof shippingHistories>;

export type OrderStatusLog = InferSelectModel<typeof orderStatusLogs>;

export type Banner = InferSelectModel<typeof banners>;
export type NewBanner = InferInsertModel<typeof banners>;

// Product with relations
export type ProductWithCategory = Product & {
  category: Category | null;
};

// Cart item with product
export type CartItemWithProduct = CartItem & {
  product: Product;
};

// Order with items
export type OrderWithItems = Order & {
  items: OrderItem[];
  user?: User;
};
