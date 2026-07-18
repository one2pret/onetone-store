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

// ============ STORES ============
// Phase 1: Fondasi marketplace. Onetone = row pertama (isOfficial=true).
// MVP: struktural saja, tanpa onboarding/payout seller.
export const stores = mysqlTable('stores', {
  id: int('id').primaryKey().autoincrement(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 150 }).notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  isOfficial: boolean('is_official').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============ MEMBER TIERS ============
// Phase 1: Silver / Gold / Platinum — benefit dikontrol lewat kolom ini.
export const memberTiers = mysqlTable('member_tiers', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 50 }).notNull(),              // "Silver", "Gold", "Platinum"
  minSpend: int('min_spend').default(0),                         // ambang total spend untuk naik tier (Rupiah)
  discountPct: int('discount_pct').default(0),                   // diskon default tier (%)
  freeShippingThreshold: int('free_shipping_threshold'),          // null = tidak dapat gratis ongkir
  pointMultiplier: int('point_multiplier').default(1),            // earn = subtotal × multiplier / 1000
  sortOrder: int('sort_order').default(0),
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
  sortOrder: int('sort_order').default(99).notNull(),
  isVisible: boolean('is_visible').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============ PRODUCTS ============
export const products = mysqlTable('products', {
  id: int('id').primaryKey().autoincrement(),
  storeId: int('store_id').references(() => stores.id),          // Phase 1: nullable, backfill ke Onetone
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
  isBestSeller: boolean('is_best_seller').default(false),
  channel: mysqlEnum('channel', ['all', 'store_only', 'marketplace_only']).default('all').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ PRODUCT VARIANTS ============
export const productVariants = mysqlTable('product_variants', {
  id: int('id').primaryKey().autoincrement(),
  productId: int('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  size: varchar('size', { length: 20 }).notNull(),   // S, M, L, XL, XXL, XXXL, FREE SIZE
  color: varchar('color', { length: 100 }).notNull(), // Mauve Wine, Black, Navy, dll
  colorHex: varchar('color_hex', { length: 7 }),      // opsional: #7B3F5E untuk swatch UI
  stock: int('stock').default(0).notNull(),
  priceModifier: decimal('price_modifier', { precision: 10, scale: 2 }).default('0'), // +/- dari harga dasar
  sku: varchar('sku', { length: 100 }),               // opsional: kode SKU per varian
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ CART ITEMS ============
export const cartItems = mysqlTable('cart_items', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id).notNull(),
  productId: int('product_id').references(() => products.id).notNull(),
  variantId: int('variant_id').references(() => productVariants.id), // nullable = produk tanpa varian
  quantity: int('quantity').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ POS SESSIONS ============
// Konsep Odoo POS: kasir buka sesi (opening cash), transaksi terjadi selama sesi
// aktif, kasir tutup sesi (closing cash) → Z-report hitung selisih.
export const posSessions = mysqlTable('pos_sessions', {
  id: int('id').primaryKey().autoincrement(),
  cashierId: int('cashier_id').references(() => users.id).notNull(),
  openedAt: timestamp('opened_at').defaultNow(),
  closedAt: timestamp('closed_at'),
  openingCash: decimal('opening_cash', { precision: 12, scale: 2 }).notNull(),
  closingCash: decimal('closing_cash', { precision: 12, scale: 2 }),      // hitungan fisik saat tutup
  expectedCash: decimal('expected_cash', { precision: 12, scale: 2 }),    // openingCash + total cash sales
  cashDifference: decimal('cash_difference', { precision: 12, scale: 2 }),// closingCash - expectedCash
  status: mysqlEnum('pos_session_status', ['open', 'closed']).default('open'),
  notes: text('notes'),
});

// ============ MEMBERSHIPS ============
// Phase 1: 1 user : 1 membership row. Auto-create saat register atau order pertama.
export const memberships = mysqlTable('memberships', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id).notNull().unique(),
  tierId: int('tier_id').references(() => memberTiers.id).notNull(),
  points: int('points').default(0),
  totalSpend: int('total_spend').default(0),                     // akumulasi spend (Rupiah) untuk auto-upgrade tier
  joinedAt: timestamp('joined_at').defaultNow(),
});

// ============ VOUCHERS ============
// Phase 1: Struktural. Mechanic diterapkan di Phase 4 (checkout integration).
export const vouchers = mysqlTable('vouchers', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: mysqlEnum('voucher_type', ['fixed', 'percent', 'free_shipping']).notNull(),
  value: int('value').default(0),                                // nominal/pct diskon; 0 untuk free_shipping
  minSpend: int('min_spend').default(0),                         // minimum order untuk bisa pakai voucher
  storeId: int('store_id').references(() => stores.id),          // null = berlaku lintas store
  tierId: int('tier_id').references(() => memberTiers.id),       // null = berlaku semua tier
  quota: int('quota'),                                           // null = unlimited
  usedCount: int('used_count').default(0),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  isActive: boolean('is_active').default(true),
});

// ============ ORDERS ============
// Channel 'online' = order dari web/mobile (butuh alamat, kirim via kurir).
// Channel 'pos' = transaksi kasir offline (langsung delivered, cash/QRIS/transfer).
export const orders = mysqlTable('orders', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id), // nullable — walk-in customer POS tanpa akun
  storeId: int('store_id').references(() => stores.id),          // Phase 1: nullable, backfill ke Onetone
  voucherId: int('voucher_id').references(() => vouchers.id),    // Phase 1: nullable
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  channel: mysqlEnum('order_channel', ['online', 'pos']).default('online'),
  status: mysqlEnum('status', [
    'waiting_payment',
    'packing',
    'shipping',
    'delivered',
    'expired',
    'cancelled',
  ]).default('waiting_payment'),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'), // Phase 1
  shippingCost: decimal('shipping_cost', { precision: 12, scale: 2 }).default('0'),
  total: decimal('total', { precision: 12, scale: 2 }).notNull(),
  pointsEarned: int('points_earned').default(0),                 // Phase 1: poin didapat dari order ini
  pointsRedeemed: int('points_redeemed').default(0),             // Phase 1: poin dipakai di order ini
  // Shipping fields — nullable karena POS tidak perlu alamat pengiriman
  shippingAddress: text('shipping_address'),
  shippingPhone: varchar('shipping_phone', { length: 20 }),
  shippingName: varchar('shipping_name', { length: 255 }),
  notes: text('notes'),
  // POS-specific fields
  posSessionId: int('pos_session_id').references(() => posSessions.id),
  posPaymentMethod: mysqlEnum('pos_payment_method', ['cash', 'qris', 'transfer']),
  cashReceived: decimal('cash_received', { precision: 12, scale: 2 }),
  cashChange: decimal('cash_change', { precision: 12, scale: 2 }),
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
  variantId: int('variant_id').references(() => productVariants.id), // simpan referensi varian
  productName: varchar('product_name', { length: 255 }).notNull(),
  productImage: varchar('product_image', { length: 500 }),
  variantLabel: varchar('variant_label', { length: 100 }), // "L / Mauve Wine" — snapshot saat beli
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
  changedBy: varchar('changed_by', { length: 100 }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

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

// ============ PRODUCT IMAGES ============
export const productImages = mysqlTable("product_images", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  objectKey: varchar("object_key", { length: 500 }).notNull(),
  objectKeyOriginal: varchar("object_key_original", { length: 500 }),
  objectKeyThumb: varchar("object_key_thumb", { length: 500 }),
  filenameOriginal: varchar("filename_original", { length: 255 }),
  mime: varchar("mime", { length: 100 }).default("image/webp"),
  width: int("width"),
  height: int("height"),
  filesize: int("filesize"),
  checksum: varchar("checksum", { length: 64 }),
  sortOrder: int("sort_order").default(0),
  isPrimary: boolean("is_primary").default(false),
  variantColor: varchar("variant_color", { length: 100 }), // null = gambar umum, isi = gambar untuk warna tertentu
  createdAt: timestamp("created_at").defaultNow(),
});

// ============ POINTS LEDGER ============
// Phase 1: Audit trail semua mutasi poin. Jangan simpan saldo saja.
// delta > 0 = earn, delta < 0 = redeem. Saldo = SUM(delta) per membershipId.
export const pointsLedger = mysqlTable('points_ledger', {
  id: int('id').primaryKey().autoincrement(),
  membershipId: int('membership_id').references(() => memberships.id).notNull(),
  orderId: int('order_id').references(() => orders.id),          // nullable: poin bisa diberikan manual
  delta: int('delta').notNull(),
  reason: varchar('reason', { length: 100 }),                    // "order_earn", "order_redeem", "manual_adjust"
  createdAt: timestamp('created_at').defaultNow(),
});

// ============ RELATIONS ============

export const usersRelations = relations(users, ({ one, many }) => ({
  orders: many(orders),
  cartItems: many(cartItems),
  addresses: many(addresses),
  posSessions: many(posSessions),
  membership: one(memberships, { fields: [users.id], references: [memberships.userId] }),
}));

export const posSessionsRelations = relations(posSessions, ({ one, many }) => ({
  cashier: one(users, { fields: [posSessions.cashierId], references: [users.id] }),
  orders: many(orders),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const storesRelations = relations(stores, ({ many }) => ({
  products: many(products),
  orders: many(orders),
  vouchers: many(vouchers),
}));

export const memberTiersRelations = relations(memberTiers, ({ many }) => ({
  memberships: many(memberships),
  vouchers: many(vouchers),
}));

export const membershipsRelations = relations(memberships, ({ one, many }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  tier: one(memberTiers, { fields: [memberships.tierId], references: [memberTiers.id] }),
  ledger: many(pointsLedger),
}));

export const vouchersRelations = relations(vouchers, ({ one, many }) => ({
  store: one(stores, { fields: [vouchers.storeId], references: [stores.id] }),
  tier: one(memberTiers, { fields: [vouchers.tierId], references: [memberTiers.id] }),
  orders: many(orders),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, { fields: [products.storeId], references: [stores.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, { fields: [cartItems.userId], references: [users.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  store: one(stores, { fields: [orders.storeId], references: [stores.id] }),
  voucher: one(vouchers, { fields: [orders.voucherId], references: [vouchers.id] }),
  posSession: one(posSessions, { fields: [orders.posSessionId], references: [posSessions.id] }),
  items: many(orderItems),
  invoices: many(invoices),
  shippings: many(shippings),
  statusLogs: many(orderStatusLogs),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  order: one(orders, { fields: [invoices.orderId], references: [orders.id] }),
}));

export const shippingsRelations = relations(shippings, ({ one, many }) => ({
  order: one(orders, { fields: [shippings.orderId], references: [orders.id] }),
  histories: many(shippingHistories),
}));

export const shippingHistoriesRelations = relations(shippingHistories, ({ one }) => ({
  shipping: one(shippings, { fields: [shippingHistories.shippingId], references: [shippings.id] }),
}));

export const orderStatusLogsRelations = relations(orderStatusLogs, ({ one }) => ({
  order: one(orders, { fields: [orderStatusLogs.orderId], references: [orders.id] }),
}));

export const pointsLedgerRelations = relations(pointsLedger, ({ one }) => ({
  membership: one(memberships, { fields: [pointsLedger.membershipId], references: [memberships.id] }),
  order: one(orders, { fields: [pointsLedger.orderId], references: [orders.id] }),
}));

// ============ TYPE INFERENCE ============
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Address = InferSelectModel<typeof addresses>;
export type NewAddress = InferInsertModel<typeof addresses>;

export type StoreSetting = InferSelectModel<typeof storeSettings>;

export type Store = InferSelectModel<typeof stores>;
export type NewStore = InferInsertModel<typeof stores>;

export type MemberTier = InferSelectModel<typeof memberTiers>;
export type NewMemberTier = InferInsertModel<typeof memberTiers>;

export type Membership = InferSelectModel<typeof memberships>;
export type NewMembership = InferInsertModel<typeof memberships>;

export type Voucher = InferSelectModel<typeof vouchers>;
export type NewVoucher = InferInsertModel<typeof vouchers>;

export type PointsLedgerEntry = InferSelectModel<typeof pointsLedger>;
export type NewPointsLedgerEntry = InferInsertModel<typeof pointsLedger>;

export type Courier = InferSelectModel<typeof couriers>;

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;

export type ProductVariant = InferSelectModel<typeof productVariants>;
export type NewProductVariant = InferInsertModel<typeof productVariants>;

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

export type PosSession = InferSelectModel<typeof posSessions>;
export type NewPosSession = InferInsertModel<typeof posSessions>;

export type ProductImage = InferSelectModel<typeof productImages>;
export type NewProductImage = InferInsertModel<typeof productImages>;

// Product with relations
export type ProductWithCategory = Product & {
  category: Category | null;
};

export type ProductWithVariants = Product & {
  category: Category | null;
  variants: ProductVariant[];
};

// Cart item with product & variant
export type CartItemWithProduct = CartItem & {
  product: Product;
  variant?: ProductVariant | null;
};

// Order with items
export type OrderWithItems = Order & {
  items: OrderItem[];
  user?: User;
};

// Membership with tier
export type MembershipWithTier = Membership & {
  tier: MemberTier;
};
