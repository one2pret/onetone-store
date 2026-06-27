// lib/db/seed.ts — Complete realistic seed data for every flow
import { db } from './index';
import {
  users, categories, products, addresses, storeSettings, couriers,
  orders, orderItems, invoices, shippings, shippingHistories,
  orderStatusLogs, cartItems, banners,
} from './schema';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

function daysAgo(days: number, hours = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d;
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function seed() {
  console.log('🌱 Seeding database with realistic data...\n');

  // ==========================================
  // CLEAN ALL TABLES (in FK order)
  // ==========================================
  console.log('🗑️  Cleaning tables...');
  await db.delete(shippingHistories);
  await db.delete(orderStatusLogs);
  await db.delete(invoices);
  await db.delete(shippings);
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(cartItems);
  await db.delete(products);
  await db.delete(categories);
  await db.delete(addresses);
  await db.delete(couriers);
  await db.delete(storeSettings);
  await db.delete(banners);
  await db.delete(users);

  // Reset auto-increment
  const tables = [
    'users', 'addresses', 'store_settings', 'couriers', 'categories',
    'products', 'cart_items', 'orders', 'order_items', 'invoices',
    'shippings', 'shipping_histories', 'order_status_logs', 'banners',
  ];
  for (const table of tables) {
    await db.execute(sql.raw(`ALTER TABLE ${table} AUTO_INCREMENT = 1`));
  }
  console.log('✅ Tables cleaned\n');

  // ==========================================
  // 1. USERS (1 admin + 4 customers)
  // ==========================================
  const hashedPassword = await bcrypt.hash('password123', 10);

  await db.insert(users).values([
    { // id: 1
      name: 'Pak Budi (Admin)',
      email: 'admin@store.com',
      password: hashedPassword,
      phone: '081234567890',
      role: 'admin',
    },
    { // id: 2
      name: 'Rina Kartika',
      email: 'rina@gmail.com',
      password: hashedPassword,
      phone: '081298765432',
      address: 'Jl. Melati No. 45, Jakarta Selatan',
      role: 'customer',
    },
    { // id: 3
      name: 'Andi Saputra',
      email: 'andi.saputra@gmail.com',
      password: hashedPassword,
      phone: '085678901234',
      address: 'Jl. Pahlawan No. 12, Bandung',
      role: 'customer',
    },
    { // id: 4
      name: 'Siti Nurhaliza',
      email: 'siti.nur@yahoo.com',
      password: hashedPassword,
      phone: '087812345678',
      address: 'Jl. Diponegoro No. 88, Surabaya',
      role: 'customer',
    },
    { // id: 5
      name: 'Dimas Prasetyo',
      email: 'dimas.p@gmail.com',
      password: hashedPassword,
      phone: '082345678901',
      address: 'Jl. Ahmad Yani No. 33, Semarang',
      role: 'customer',
    },
  ]);
  console.log('👤 5 users created (1 admin, 4 customers)');

  // ==========================================
  // 2. ADDRESSES (multiple per customer)
  // ==========================================
  await db.insert(addresses).values([
    // Rina (user 2) — 2 addresses
    { // id: 1
      userId: 2,
      label: 'Rumah',
      recipientName: 'Rina Kartika',
      phone: '081298765432',
      address: 'Jl. Melati No. 45, RT 03/RW 07, Kebayoran Baru',
      detail: 'Pagar hitam, sebelah minimarket Alfamart',
      province: 'DKI Jakarta',
      provinceId: '31',
      city: 'Jakarta Selatan',
      cityId: '3171',
      district: 'Kebayoran Baru',
      districtId: '3171060',
      postalCode: '12120',
      latitude: '-6.2441',
      longitude: '106.7834',
      isDefault: true,
    },
    { // id: 2
      userId: 2,
      label: 'Kantor',
      recipientName: 'Rina Kartika',
      phone: '081298765432',
      address: 'Jl. Jend. Sudirman Kav. 52-53, Senayan',
      detail: 'Gedung SCBD Tower Lt. 21, resepsionis lobby A',
      province: 'DKI Jakarta',
      provinceId: '31',
      city: 'Jakarta Selatan',
      cityId: '3171',
      district: 'Senayan',
      districtId: '3171060',
      postalCode: '12190',
      latitude: '-6.2247',
      longitude: '106.8083',
      isDefault: false,
    },
    // Andi (user 3) — 2 addresses
    { // id: 3
      userId: 3,
      label: 'Rumah',
      recipientName: 'Andi Saputra',
      phone: '085678901234',
      address: 'Jl. Pahlawan No. 12, RT 02/RW 05, Coblong',
      detail: 'Gang Mawar No. 3, dekat masjid besar',
      province: 'Jawa Barat',
      provinceId: '32',
      city: 'Bandung',
      cityId: '3273',
      district: 'Coblong',
      districtId: '3273230',
      postalCode: '40132',
      latitude: '-6.8938',
      longitude: '107.6163',
      isDefault: true,
    },
    { // id: 4
      userId: 3,
      label: 'Kos',
      recipientName: 'Andi Saputra',
      phone: '085678901234',
      address: 'Jl. Dago Atas No. 78, Dago',
      detail: 'Kos Pak Haji lantai 2 kamar 5',
      province: 'Jawa Barat',
      provinceId: '32',
      city: 'Bandung',
      cityId: '3273',
      district: 'Coblong',
      districtId: '3273230',
      postalCode: '40135',
      latitude: '-6.8700',
      longitude: '107.6140',
      isDefault: false,
    },
    // Siti (user 4) — 1 address
    { // id: 5
      userId: 4,
      label: 'Rumah',
      recipientName: 'Siti Nurhaliza',
      phone: '087812345678',
      address: 'Jl. Diponegoro No. 88, RT 01/RW 04, Darmo',
      detail: 'Rumah cat biru, pagar kayu',
      province: 'Jawa Timur',
      provinceId: '35',
      city: 'Surabaya',
      cityId: '3578',
      district: 'Wonokromo',
      districtId: '3578110',
      postalCode: '60241',
      latitude: '-7.2908',
      longitude: '112.7388',
      isDefault: true,
    },
    // Dimas (user 5) — 1 address
    { // id: 6
      userId: 5,
      label: 'Rumah',
      recipientName: 'Dimas Prasetyo',
      phone: '082345678901',
      address: 'Jl. Ahmad Yani No. 33, RT 06/RW 02, Pekunden',
      detail: 'Perumahan Griya Indah Blok C No. 15',
      province: 'Jawa Tengah',
      provinceId: '33',
      city: 'Semarang',
      cityId: '3374',
      district: 'Semarang Tengah',
      districtId: '3374130',
      postalCode: '50134',
      latitude: '-6.9823',
      longitude: '110.4193',
      isDefault: true,
    },
  ]);
  console.log('📍 6 addresses created');

  // ==========================================
  // 3. STORE SETTINGS
  // ==========================================
  await db.insert(storeSettings).values([
    { key: 'store_name', value: 'NextElektronik' },
    { key: 'store_phone', value: '081234567890' },
    { key: 'store_address', value: 'Jl. Mangga Dua Raya No. 1, Sawah Besar, Jakarta Utara 10730' },
    { key: 'store_latitude', value: '-6.1380' },
    { key: 'store_longitude', value: '106.8294' },
    { key: 'payment_expiry_hours', value: '24' },
  ]);
  console.log('⚙️  6 store settings created');

  // ==========================================
  // 4. COURIERS
  // ==========================================
  await db.insert(couriers).values([
    { name: 'JNE', code: 'jne', isActive: true },
    { name: 'J&T Express', code: 'jnt', isActive: true },
    { name: 'SiCepat', code: 'sicepat', isActive: true },
    { name: 'TIKI', code: 'tiki', isActive: true },
    { name: 'Anteraja', code: 'anteraja', isActive: true },
    { name: 'Pos Indonesia', code: 'pos', isActive: false },
  ]);
  console.log('🚚 6 couriers created');

  // ==========================================
  // 5. CATEGORIES
  // ==========================================
  await db.insert(categories).values([
    { name: 'Smartphone & Tablet', slug: 'smartphone-tablet', description: 'HP, tablet, dan aksesoris mobile' },
    { name: 'Laptop & Komputer', slug: 'laptop-komputer', description: 'Laptop, PC, monitor, dan peripheral' },
    { name: 'Audio & Headphone', slug: 'audio-headphone', description: 'Earbuds, headphone, speaker, dan soundbar' },
    { name: 'Wearable & Smartwatch', slug: 'wearable-smartwatch', description: 'Smartwatch, fitness tracker, dan wearable tech' },
    { name: 'Aksesoris & Gadget', slug: 'aksesoris-gadget', description: 'Charger, kabel, case, powerbank, dan lainnya' },
  ]);
  console.log('📂 5 categories created');

  // ==========================================
  // 6. PRODUCTS (17 products)
  // ==========================================
  await db.insert(products).values([
    // id:1 — Smartphone & Tablet
    { categoryId: 1, name: 'iPhone 15 Pro Max 256GB', slug: 'iphone-15-pro-max', price: '19500000', stock: 15, weight: 221, isActive: true, isFeatured: true, description: 'iPhone 15 Pro Max dengan chip A17 Pro, kamera 48MP, dan Dynamic Island. Titanium design.', image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&h=500&fit=crop' },
    // id:2
    { categoryId: 1, name: 'Samsung Galaxy S24 Ultra', slug: 'samsung-galaxy-s24-ultra', price: '18999000', stock: 20, weight: 232, isActive: true, isFeatured: true, description: 'Galaxy S24 Ultra dengan Galaxy AI, S Pen built-in, dan kamera 200MP.', image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&h=500&fit=crop' },
    // id:3
    { categoryId: 1, name: 'iPad Air M2 11 inch', slug: 'ipad-air-m2', price: '10999000', stock: 25, weight: 462, isActive: true, description: 'iPad Air dengan chip M2, layar Liquid Retina 11 inch, dan Apple Pencil support.', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&h=500&fit=crop' },
    // id:4
    { categoryId: 1, name: 'Xiaomi Redmi Note 13 Pro', slug: 'redmi-note-13-pro', price: '3299000', stock: 50, weight: 187, isActive: true, description: 'Redmi Note 13 Pro dengan kamera 200MP, layar AMOLED 120Hz, dan fast charging 67W.', image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&h=500&fit=crop' },
    // id:5 — Laptop & Komputer
    { categoryId: 2, name: 'MacBook Air M3 15 inch', slug: 'macbook-air-m3', price: '22999000', stock: 10, weight: 1510, isActive: true, isFeatured: true, description: 'MacBook Air dengan chip M3, layar Liquid Retina 15.3 inch, baterai hingga 18 jam.', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&h=500&fit=crop' },
    // id:6
    { categoryId: 2, name: 'ASUS ROG Strix G16', slug: 'asus-rog-strix-g16', price: '18500000', stock: 12, weight: 2500, isActive: true, isFeatured: true, description: 'Laptop gaming dengan RTX 4060, Intel Core i7 Gen 13, layar 165Hz.', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500&h=500&fit=crop' },
    // id:7
    { categoryId: 2, name: 'Monitor LG UltraWide 34"', slug: 'lg-ultrawide-34', price: '5999000', stock: 18, weight: 7200, isActive: true, description: 'Monitor ultrawide 34 inch QHD IPS, 75Hz, HDR10, USB-C connectivity.', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&h=500&fit=crop' },
    // id:8 — Audio & Headphone
    { categoryId: 3, name: 'AirPods Pro 2nd Gen', slug: 'airpods-pro-2', price: '3799000', stock: 40, weight: 51, isActive: true, isFeatured: true, description: 'AirPods Pro dengan Active Noise Cancellation, chip H2, dan USB-C charging case.', image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=500&h=500&fit=crop' },
    // id:9
    { categoryId: 3, name: 'Sony WH-1000XM5', slug: 'sony-wh-1000xm5', price: '4999000', stock: 25, weight: 250, isActive: true, description: 'Headphone wireless premium dengan noise cancelling terbaik di kelasnya, 30 jam baterai.', image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=500&h=500&fit=crop' },
    // id:10
    { categoryId: 3, name: 'JBL Flip 6 Speaker', slug: 'jbl-flip-6', price: '1599000', stock: 35, weight: 550, isActive: true, description: 'Speaker bluetooth portable, waterproof IP67, 12 jam baterai, suara bass powerful.', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&h=500&fit=crop' },
    // id:11
    { categoryId: 3, name: 'Marshall Stanmore III', slug: 'marshall-stanmore-3', price: '5500000', stock: 10, weight: 4350, isActive: true, description: 'Speaker bluetooth premium dengan desain ikonik Marshall, Bluetooth 5.2.', image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&h=500&fit=crop' },
    // id:12 — Wearable & Smartwatch
    { categoryId: 4, name: 'Apple Watch Series 9', slug: 'apple-watch-series-9', price: '6499000', stock: 30, weight: 39, isActive: true, isFeatured: true, description: 'Apple Watch Series 9 dengan chip S9, Double Tap gesture, dan layar Always-On Retina.', image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=500&h=500&fit=crop' },
    // id:13
    { categoryId: 4, name: 'Samsung Galaxy Watch 6', slug: 'galaxy-watch-6', price: '3999000', stock: 22, weight: 34, isActive: true, description: 'Galaxy Watch6 dengan BioActive Sensor, sleep coaching, dan Wear OS by Google.', image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500&h=500&fit=crop' },
    // id:14 — Aksesoris & Gadget
    { categoryId: 5, name: 'Anker PowerBank 20000mAh', slug: 'anker-powerbank-20000', price: '450000', stock: 80, weight: 350, isActive: true, description: 'Powerbank 20000mAh dengan fast charging 22.5W, dual USB output, compact design.', image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500&h=500&fit=crop' },
    // id:15
    { categoryId: 5, name: 'Charger Anker Nano 65W', slug: 'charger-anker-nano-65w', price: '599000', stock: 60, weight: 120, isActive: true, description: 'Charger GaN 65W ultra compact, 2x USB-C, bisa charge laptop dan HP sekaligus.', image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500&h=500&fit=crop' },
    // id:16
    { categoryId: 5, name: 'Logitech MX Master 3S', slug: 'logitech-mx-master-3s', price: '1399000', stock: 35, weight: 141, isActive: true, description: 'Mouse wireless premium dengan sensor 8000 DPI, MagSpeed scroll, USB-C charging.', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&h=500&fit=crop' },
    // id:17 — inactive product (stok habis)
    { categoryId: 5, name: 'Kabel USB-C to Lightning 2M', slug: 'kabel-usbc-lightning-2m', price: '199000', stock: 0, weight: 40, isActive: false, description: 'Kabel USB-C ke Lightning 2 meter, MFi certified, fast charging support.', image: null },
  ]);
  console.log('📦 17 products created');

  // ==========================================
  // 7. ORDERS — Cover every status flow
  // ==========================================

  // === ORDER 1: DELIVERED (complete happy path) — Rina ===
  // Flow: waiting_payment → packing (paid) → shipping → delivered
  await db.insert(orders).values({
    userId: 2,
    orderNumber: 'ORD260420A1B2',
    status: 'delivered',
    subtotal: '23298000.00',
    shippingCost: '38000.00',
    total: '23336000.00',
    shippingName: 'Rina Kartika',
    shippingPhone: '081298765432',
    shippingAddress: 'Jl. Melati No. 45, RT 03/RW 07, Kebayoran Baru, Jakarta Selatan',
    notes: 'Tolong packing yang rapi ya, ini untuk hadiah',
    willExpiredAt: daysAgo(10),
    paidAt: daysAgo(10, -1),
    shippingAt: daysAgo(9),
    deliveredAt: daysAgo(7),
    createdAt: daysAgo(10, 2),
  });

  await db.insert(orderItems).values([
    { orderId: 1, productId: 1, productName: 'iPhone 15 Pro Max 256GB', productImage: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&h=500&fit=crop', price: '19500000.00', quantity: 1, subtotal: '19500000.00' },
    { orderId: 1, productId: 8, productName: 'AirPods Pro 2nd Gen', productImage: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=500&h=500&fit=crop', price: '3799000.00', quantity: 1, subtotal: '3799000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 1,
    xenditId: 'inv_6807a1b2c3d4e5f6a7b8c9d0',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/6807a1b2c3d4e5f6a7b8c9d0',
    paymentMethod: 'VIRTUAL_ACCOUNT',
    paymentChannel: 'BCA',
    amount: '23336000.00',
    status: 'paid',
    paidAt: daysAgo(10, -1),
    expiredAt: daysAgo(9),
    createdAt: daysAgo(10, 2),
  });

  await db.insert(shippings).values({
    orderId: 1,
    recipientName: 'Rina Kartika',
    phone: '081298765432',
    address: 'Jl. Melati No. 45, RT 03/RW 07, Kebayoran Baru, Jakarta Selatan',
    addressDetail: 'Pagar hitam, sebelah minimarket Alfamart',
    latitude: '-6.2441',
    longitude: '106.7834',
    trackingId: 'BITSHIP-TRK-001',
    waybillId: 'JNE1234567890',
    courierName: 'JNE REG',
    courierCompany: 'jne',
    courierType: 'reg',
    price: '38000.00',
    estimateDays: '2-3',
    status: 'delivered',
  });

  await db.insert(shippingHistories).values([
    { shippingId: 1, status: 'confirmed', note: 'Pesanan dikonfirmasi oleh kurir JNE', updatedAt: daysAgo(9, 2) },
    { shippingId: 1, status: 'allocated', note: 'Kurir dialokasikan untuk pengambilan', updatedAt: daysAgo(9, 1) },
    { shippingId: 1, status: 'picked', note: 'Paket sudah diambil dari toko Mangga Dua', updatedAt: daysAgo(9) },
    { shippingId: 1, status: 'dropping_off', note: 'Paket dalam perjalanan ke Jakarta Selatan', updatedAt: daysAgo(8) },
    { shippingId: 1, status: 'delivered', note: 'Paket diterima oleh Rina Kartika', updatedAt: daysAgo(7) },
  ]);

  await db.insert(orderStatusLogs).values([
    { orderId: 1, fromStatus: 'waiting_payment', toStatus: 'packing', changedBy: 'webhook:xendit', note: 'Pembayaran via BCA Virtual Account', createdAt: daysAgo(10, -1) },
    { orderId: 1, fromStatus: 'packing', toStatus: 'shipping', changedBy: 'admin:1', note: 'Dikirim via JNE REG', createdAt: daysAgo(9) },
    { orderId: 1, fromStatus: 'shipping', toStatus: 'delivered', changedBy: 'webhook:bitship', note: 'Paket diterima', createdAt: daysAgo(7) },
  ]);

  // === ORDER 2: SHIPPING (in transit) — Andi ===
  await db.insert(orders).values({
    userId: 3,
    orderNumber: 'ORD260423C4D5',
    status: 'shipping',
    subtotal: '22999000.00',
    shippingCost: '55000.00',
    total: '23054000.00',
    shippingName: 'Andi Saputra',
    shippingPhone: '085678901234',
    shippingAddress: 'Jl. Pahlawan No. 12, RT 02/RW 05, Coblong, Bandung',
    notes: null,
    willExpiredAt: daysAgo(4),
    paidAt: daysAgo(4, -2),
    shippingAt: daysAgo(2),
    createdAt: daysAgo(4, 3),
  });

  await db.insert(orderItems).values([
    { orderId: 2, productId: 5, productName: 'MacBook Air M3 15 inch', productImage: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&h=500&fit=crop', price: '22999000.00', quantity: 1, subtotal: '22999000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 2,
    xenditId: 'inv_6808b2c3d4e5f6a7b8c9d0e1',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/6808b2c3d4e5f6a7b8c9d0e1',
    paymentMethod: 'EWALLET',
    paymentChannel: 'SHOPEEPAY',
    amount: '23054000.00',
    status: 'paid',
    paidAt: daysAgo(4, -2),
    expiredAt: daysAgo(3),
    createdAt: daysAgo(4, 3),
  });

  await db.insert(shippings).values({
    orderId: 2,
    recipientName: 'Andi Saputra',
    phone: '085678901234',
    address: 'Jl. Pahlawan No. 12, RT 02/RW 05, Coblong, Bandung',
    addressDetail: 'Gang Mawar No. 3, dekat masjid besar',
    latitude: '-6.8938',
    longitude: '107.6163',
    trackingId: 'BITSHIP-TRK-002',
    waybillId: 'SICPT9876543210',
    courierName: 'SiCepat REG',
    courierCompany: 'sicepat',
    courierType: 'reg',
    price: '55000.00',
    estimateDays: '3-4',
    status: 'dropping_off',
  });

  await db.insert(shippingHistories).values([
    { shippingId: 2, status: 'confirmed', note: 'Pesanan dikonfirmasi oleh SiCepat', updatedAt: daysAgo(2, 3) },
    { shippingId: 2, status: 'picked', note: 'Paket diambil dari gudang Mangga Dua', updatedAt: daysAgo(2, 1) },
    { shippingId: 2, status: 'dropping_off', note: 'Paket transit di Hub Bandung, menuju alamat tujuan', updatedAt: daysAgo(1) },
  ]);

  await db.insert(orderStatusLogs).values([
    { orderId: 2, fromStatus: 'waiting_payment', toStatus: 'packing', changedBy: 'webhook:xendit', note: 'Pembayaran via ShopeePay', createdAt: daysAgo(4, -2) },
    { orderId: 2, fromStatus: 'packing', toStatus: 'shipping', changedBy: 'admin:1', note: 'Dikirim via SiCepat REG', createdAt: daysAgo(2) },
  ]);

  // === ORDER 3: PACKING (paid, ready to ship) — Siti ===
  await db.insert(orders).values({
    userId: 4,
    orderNumber: 'ORD260425E6F7',
    status: 'packing',
    subtotal: '8298000.00',
    shippingCost: '42000.00',
    total: '8340000.00',
    shippingName: 'Siti Nurhaliza',
    shippingPhone: '087812345678',
    shippingAddress: 'Jl. Diponegoro No. 88, RT 01/RW 04, Darmo, Surabaya',
    notes: 'Jangan dilempar ya paketnya, barang elektronik',
    willExpiredAt: daysAgo(2),
    paidAt: daysAgo(1, 5),
    createdAt: daysAgo(2, 1),
  });

  await db.insert(orderItems).values([
    { orderId: 3, productId: 9, productName: 'Sony WH-1000XM5', productImage: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=500&h=500&fit=crop', price: '4999000.00', quantity: 1, subtotal: '4999000.00' },
    { orderId: 3, productId: 4, productName: 'Xiaomi Redmi Note 13 Pro', productImage: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&h=500&fit=crop', price: '3299000.00', quantity: 1, subtotal: '3299000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 3,
    xenditId: 'inv_6809c3d4e5f6a7b8c9d0e1f2',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/6809c3d4e5f6a7b8c9d0e1f2',
    paymentMethod: 'QR_CODE',
    paymentChannel: 'QRIS',
    amount: '8340000.00',
    status: 'paid',
    paidAt: daysAgo(1, 5),
    expiredAt: daysAgo(1),
    createdAt: daysAgo(2, 1),
  });

  await db.insert(shippings).values({
    orderId: 3,
    recipientName: 'Siti Nurhaliza',
    phone: '087812345678',
    address: 'Jl. Diponegoro No. 88, RT 01/RW 04, Darmo, Surabaya',
    addressDetail: 'Rumah cat biru, pagar kayu',
    latitude: '-7.2908',
    longitude: '112.7388',
    courierName: 'J&T Express REG',
    courierCompany: 'jnt',
    courierType: 'reg',
    price: '42000.00',
    estimateDays: '3-4',
    status: null,
  });

  await db.insert(orderStatusLogs).values([
    { orderId: 3, fromStatus: 'waiting_payment', toStatus: 'packing', changedBy: 'webhook:xendit', note: 'Pembayaran via QRIS', createdAt: daysAgo(1, 5) },
  ]);

  // === ORDER 4: WAITING_PAYMENT (fresh, 20h left) — Rina ===
  await db.insert(orders).values({
    userId: 2,
    orderNumber: 'ORD260426G8H9',
    status: 'waiting_payment',
    subtotal: '6499000.00',
    shippingCost: '25000.00',
    total: '6524000.00',
    shippingName: 'Rina Kartika',
    shippingPhone: '081298765432',
    shippingAddress: 'Jl. Jend. Sudirman Kav. 52-53, Senayan, Jakarta Selatan',
    notes: 'Kirim ke kantor, jam kerja 09:00-17:00',
    willExpiredAt: hoursFromNow(20),
    createdAt: daysAgo(0, 4),
  });

  await db.insert(orderItems).values([
    { orderId: 4, productId: 12, productName: 'Apple Watch Series 9', productImage: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=500&h=500&fit=crop', price: '6499000.00', quantity: 1, subtotal: '6499000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 4,
    xenditId: 'inv_680ad4e5f6a7b8c9d0e1f2a3',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/680ad4e5f6a7b8c9d0e1f2a3',
    amount: '6524000.00',
    status: 'pending',
    expiredAt: hoursFromNow(20),
    createdAt: daysAgo(0, 4),
  });

  await db.insert(shippings).values({
    orderId: 4,
    recipientName: 'Rina Kartika',
    phone: '081298765432',
    address: 'Jl. Jend. Sudirman Kav. 52-53, Senayan, Jakarta Selatan',
    addressDetail: 'Gedung SCBD Tower Lt. 21, resepsionis lobby A',
    latitude: '-6.2247',
    longitude: '106.8083',
    courierName: 'Anteraja Same Day',
    courierCompany: 'anteraja',
    courierType: 'same_day',
    price: '25000.00',
    estimateDays: '0-1',
    status: null,
  });

  // === ORDER 5: WAITING_PAYMENT (almost expired, 2h left) — Dimas ===
  await db.insert(orders).values({
    userId: 5,
    orderNumber: 'ORD260426J1K2',
    status: 'waiting_payment',
    subtotal: '2048000.00',
    shippingCost: '30000.00',
    total: '2078000.00',
    shippingName: 'Dimas Prasetyo',
    shippingPhone: '082345678901',
    shippingAddress: 'Jl. Ahmad Yani No. 33, Pekunden, Semarang',
    notes: null,
    willExpiredAt: hoursFromNow(2),
    createdAt: daysAgo(0, 22),
  });

  await db.insert(orderItems).values([
    { orderId: 5, productId: 14, productName: 'Anker PowerBank 20000mAh', productImage: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500&h=500&fit=crop', price: '450000.00', quantity: 2, subtotal: '900000.00' },
    { orderId: 5, productId: 15, productName: 'Charger Anker Nano 65W', productImage: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500&h=500&fit=crop', price: '599000.00', quantity: 1, subtotal: '599000.00' },
    { orderId: 5, productId: 10, productName: 'JBL Flip 6 Speaker', productImage: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&h=500&fit=crop', price: '1599000.00', quantity: 1, subtotal: '549000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 5,
    xenditId: 'inv_680be5f6a7b8c9d0e1f2a3b4',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/680be5f6a7b8c9d0e1f2a3b4',
    amount: '2078000.00',
    status: 'pending',
    expiredAt: hoursFromNow(2),
    createdAt: daysAgo(0, 22),
  });

  await db.insert(shippings).values({
    orderId: 5,
    recipientName: 'Dimas Prasetyo',
    phone: '082345678901',
    address: 'Jl. Ahmad Yani No. 33, Pekunden, Semarang',
    addressDetail: 'Perumahan Griya Indah Blok C No. 15',
    latitude: '-6.9823',
    longitude: '110.4193',
    courierName: 'JNE YES',
    courierCompany: 'jne',
    courierType: 'yes',
    price: '30000.00',
    estimateDays: '1-2',
    status: null,
  });

  // === ORDER 6: EXPIRED (not paid in time) — Andi ===
  await db.insert(orders).values({
    userId: 3,
    orderNumber: 'ORD260422L3M4',
    status: 'expired',
    subtotal: '1399000.00',
    shippingCost: '48000.00',
    total: '1447000.00',
    shippingName: 'Andi Saputra',
    shippingPhone: '085678901234',
    shippingAddress: 'Jl. Dago Atas No. 78, Dago, Bandung',
    notes: 'Kirim ke kos',
    willExpiredAt: daysAgo(3),
    expiredAt: daysAgo(3),
    createdAt: daysAgo(5),
  });

  await db.insert(orderItems).values([
    { orderId: 6, productId: 16, productName: 'Logitech MX Master 3S', productImage: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&h=500&fit=crop', price: '1399000.00', quantity: 1, subtotal: '1399000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 6,
    xenditId: 'inv_680cf6a7b8c9d0e1f2a3b4c5',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/680cf6a7b8c9d0e1f2a3b4c5',
    amount: '1447000.00',
    status: 'expired',
    expiredAt: daysAgo(3),
    createdAt: daysAgo(5),
  });

  await db.insert(shippings).values({
    orderId: 6,
    recipientName: 'Andi Saputra',
    phone: '085678901234',
    address: 'Jl. Dago Atas No. 78, Dago, Bandung',
    addressDetail: 'Kos Pak Haji lantai 2 kamar 5',
    latitude: '-6.8700',
    longitude: '107.6140',
    courierName: 'TIKI REG',
    courierCompany: 'tiki',
    courierType: 'reg',
    price: '48000.00',
    estimateDays: '3-5',
    status: null,
  });

  await db.insert(orderStatusLogs).values([
    { orderId: 6, fromStatus: 'waiting_payment', toStatus: 'expired', changedBy: 'webhook:xendit', note: 'Pembayaran kadaluarsa setelah 24 jam', createdAt: daysAgo(3) },
  ]);

  // === ORDER 7: CANCELLED by customer — Siti ===
  await db.insert(orders).values({
    userId: 4,
    orderNumber: 'ORD260421N5P6',
    status: 'cancelled',
    subtotal: '18999000.00',
    shippingCost: '45000.00',
    total: '19044000.00',
    shippingName: 'Siti Nurhaliza',
    shippingPhone: '087812345678',
    shippingAddress: 'Jl. Diponegoro No. 88, RT 01/RW 04, Darmo, Surabaya',
    notes: null,
    willExpiredAt: daysAgo(5),
    cancelledAt: daysAgo(6),
    createdAt: daysAgo(7),
  });

  await db.insert(orderItems).values([
    { orderId: 7, productId: 2, productName: 'Samsung Galaxy S24 Ultra', productImage: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500&h=500&fit=crop', price: '18999000.00', quantity: 1, subtotal: '18999000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 7,
    xenditId: 'inv_680dg7a8b9c0d1e2f3a4b5c6',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/680dg7a8b9c0d1e2f3a4b5c6',
    amount: '19044000.00',
    status: 'cancelled',
    cancelledAt: daysAgo(6),
    expiredAt: daysAgo(5),
    createdAt: daysAgo(7),
  });

  await db.insert(shippings).values({
    orderId: 7,
    recipientName: 'Siti Nurhaliza',
    phone: '087812345678',
    address: 'Jl. Diponegoro No. 88, RT 01/RW 04, Darmo, Surabaya',
    addressDetail: 'Rumah cat biru, pagar kayu',
    latitude: '-7.2908',
    longitude: '112.7388',
    courierName: 'JNE REG',
    courierCompany: 'jne',
    courierType: 'reg',
    price: '45000.00',
    estimateDays: '3-4',
    status: null,
  });

  await db.insert(orderStatusLogs).values([
    { orderId: 7, fromStatus: 'waiting_payment', toStatus: 'cancelled', changedBy: 'user:4', note: 'Dibatalkan oleh customer: berubah pikiran', createdAt: daysAgo(6) },
  ]);

  // === ORDER 8: CANCELLED by admin (from packing) — Dimas ===
  await db.insert(orders).values({
    userId: 5,
    orderNumber: 'ORD260419Q7R8',
    status: 'cancelled',
    subtotal: '5999000.00',
    shippingCost: '35000.00',
    total: '6034000.00',
    shippingName: 'Dimas Prasetyo',
    shippingPhone: '082345678901',
    shippingAddress: 'Jl. Ahmad Yani No. 33, Pekunden, Semarang',
    notes: null,
    willExpiredAt: daysAgo(8),
    paidAt: daysAgo(9),
    cancelledAt: daysAgo(7),
    createdAt: daysAgo(10),
  });

  await db.insert(orderItems).values([
    { orderId: 8, productId: 7, productName: 'Monitor LG UltraWide 34"', productImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&h=500&fit=crop', price: '5999000.00', quantity: 1, subtotal: '5999000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 8,
    xenditId: 'inv_680eh8a9b0c1d2e3f4a5b6c7',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/680eh8a9b0c1d2e3f4a5b6c7',
    paymentMethod: 'VIRTUAL_ACCOUNT',
    paymentChannel: 'MANDIRI',
    amount: '6034000.00',
    status: 'paid',
    paidAt: daysAgo(9),
    expiredAt: daysAgo(8),
    createdAt: daysAgo(10),
  });

  await db.insert(shippings).values({
    orderId: 8,
    recipientName: 'Dimas Prasetyo',
    phone: '082345678901',
    address: 'Jl. Ahmad Yani No. 33, Pekunden, Semarang',
    addressDetail: 'Perumahan Griya Indah Blok C No. 15',
    latitude: '-6.9823',
    longitude: '110.4193',
    courierName: 'J&T Express REG',
    courierCompany: 'jnt',
    courierType: 'reg',
    price: '35000.00',
    estimateDays: '3-4',
    status: null,
  });

  await db.insert(orderStatusLogs).values([
    { orderId: 8, fromStatus: 'waiting_payment', toStatus: 'packing', changedBy: 'webhook:xendit', note: 'Pembayaran via Mandiri VA', createdAt: daysAgo(9) },
    { orderId: 8, fromStatus: 'packing', toStatus: 'cancelled', changedBy: 'admin:1', note: 'Stok produk ternyata rusak/defect saat pengecekan', createdAt: daysAgo(7) },
  ]);

  // === ORDER 9: DELIVERED (older, different customer) — Dimas ===
  await db.insert(orders).values({
    userId: 5,
    orderNumber: 'ORD260415S9T0',
    status: 'delivered',
    subtotal: '4248000.00',
    shippingCost: '28000.00',
    total: '4276000.00',
    shippingName: 'Dimas Prasetyo',
    shippingPhone: '082345678901',
    shippingAddress: 'Jl. Ahmad Yani No. 33, Pekunden, Semarang',
    notes: null,
    willExpiredAt: daysAgo(13),
    paidAt: daysAgo(13, -3),
    shippingAt: daysAgo(12),
    deliveredAt: daysAgo(10),
    createdAt: daysAgo(14),
  });

  await db.insert(orderItems).values([
    { orderId: 9, productId: 8, productName: 'AirPods Pro 2nd Gen', productImage: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=500&h=500&fit=crop', price: '3799000.00', quantity: 1, subtotal: '3799000.00' },
    { orderId: 9, productId: 14, productName: 'Anker PowerBank 20000mAh', productImage: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500&h=500&fit=crop', price: '450000.00', quantity: 1, subtotal: '450000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 9,
    xenditId: 'inv_680fi9a0b1c2d3e4f5a6b7c8',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/680fi9a0b1c2d3e4f5a6b7c8',
    paymentMethod: 'EWALLET',
    paymentChannel: 'OVO',
    amount: '4276000.00',
    status: 'paid',
    paidAt: daysAgo(13, -3),
    expiredAt: daysAgo(12),
    createdAt: daysAgo(14),
  });

  await db.insert(shippings).values({
    orderId: 9,
    recipientName: 'Dimas Prasetyo',
    phone: '082345678901',
    address: 'Jl. Ahmad Yani No. 33, Pekunden, Semarang',
    addressDetail: 'Perumahan Griya Indah Blok C No. 15',
    latitude: '-6.9823',
    longitude: '110.4193',
    trackingId: 'BITSHIP-TRK-003',
    waybillId: 'JNT0011223344',
    courierName: 'J&T Express REG',
    courierCompany: 'jnt',
    courierType: 'reg',
    price: '28000.00',
    estimateDays: '2-3',
    status: 'delivered',
  });

  await db.insert(shippingHistories).values([
    { shippingId: 7, status: 'confirmed', note: 'Pesanan dikonfirmasi J&T Express', updatedAt: daysAgo(12, 3) },
    { shippingId: 7, status: 'picked', note: 'Paket diambil dari toko', updatedAt: daysAgo(12) },
    { shippingId: 7, status: 'dropping_off', note: 'Paket transit di Hub Semarang', updatedAt: daysAgo(11) },
    { shippingId: 7, status: 'delivered', note: 'Paket diterima oleh Dimas Prasetyo', updatedAt: daysAgo(10) },
  ]);

  await db.insert(orderStatusLogs).values([
    { orderId: 9, fromStatus: 'waiting_payment', toStatus: 'packing', changedBy: 'webhook:xendit', note: 'Pembayaran via OVO', createdAt: daysAgo(13, -3) },
    { orderId: 9, fromStatus: 'packing', toStatus: 'shipping', changedBy: 'admin:1', note: 'Dikirim via J&T Express', createdAt: daysAgo(12) },
    { orderId: 9, fromStatus: 'shipping', toStatus: 'delivered', changedBy: 'webhook:bitship', note: 'Paket diterima', createdAt: daysAgo(10) },
  ]);

  // === ORDER 10: PACKING (paid today, multiple items) — Rina ===
  await db.insert(orders).values({
    userId: 2,
    orderNumber: 'ORD260427U1V2',
    status: 'packing',
    subtotal: '7198000.00',
    shippingCost: '32000.00',
    total: '7230000.00',
    shippingName: 'Rina Kartika',
    shippingPhone: '081298765432',
    shippingAddress: 'Jl. Melati No. 45, RT 03/RW 07, Kebayoran Baru, Jakarta Selatan',
    notes: 'Double wrap bubble wrap ya',
    willExpiredAt: daysAgo(0, 2),
    paidAt: daysAgo(0, 6),
    createdAt: daysAgo(0, 10),
  });

  await db.insert(orderItems).values([
    { orderId: 10, productId: 13, productName: 'Samsung Galaxy Watch 6', productImage: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500&h=500&fit=crop', price: '3999000.00', quantity: 1, subtotal: '3999000.00' },
    { orderId: 10, productId: 10, productName: 'JBL Flip 6 Speaker', productImage: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&h=500&fit=crop', price: '1599000.00', quantity: 2, subtotal: '3198000.00' },
  ]);

  await db.insert(invoices).values({
    orderId: 10,
    xenditId: 'inv_680gj0a1b2c3d4e5f6a7b8c9',
    invoiceUrl: 'https://checkout-staging.xendit.co/web/680gj0a1b2c3d4e5f6a7b8c9',
    paymentMethod: 'VIRTUAL_ACCOUNT',
    paymentChannel: 'BNI',
    amount: '7230000.00',
    status: 'paid',
    paidAt: daysAgo(0, 6),
    expiredAt: daysAgo(0, -14),
    createdAt: daysAgo(0, 10),
  });

  await db.insert(shippings).values({
    orderId: 10,
    recipientName: 'Rina Kartika',
    phone: '081298765432',
    address: 'Jl. Melati No. 45, RT 03/RW 07, Kebayoran Baru, Jakarta Selatan',
    addressDetail: 'Pagar hitam, sebelah minimarket Alfamart',
    latitude: '-6.2441',
    longitude: '106.7834',
    courierName: 'JNE REG',
    courierCompany: 'jne',
    courierType: 'reg',
    price: '32000.00',
    estimateDays: '1-2',
    status: null,
  });

  await db.insert(orderStatusLogs).values([
    { orderId: 10, fromStatus: 'waiting_payment', toStatus: 'packing', changedBy: 'webhook:xendit', note: 'Pembayaran via BNI VA', createdAt: daysAgo(0, 6) },
  ]);

  console.log('📋 10 orders created:');
  console.log('   #1 DELIVERED  — Rina (iPhone + AirPods, JNE REG, paid BCA VA)');
  console.log('   #2 SHIPPING   — Andi (MacBook Air, SiCepat, paid ShopeePay)');
  console.log('   #3 PACKING    — Siti (Sony + Redmi, J&T, paid QRIS)');
  console.log('   #4 WAITING    — Rina (Apple Watch, Anteraja, 20h left)');
  console.log('   #5 WAITING    — Dimas (PowerBank+Charger+JBL, JNE YES, 2h left!)');
  console.log('   #6 EXPIRED    — Andi (Logitech Mouse, TIKI, not paid)');
  console.log('   #7 CANCELLED  — Siti (Galaxy S24, cancelled by customer)');
  console.log('   #8 CANCELLED  — Dimas (LG Monitor, cancelled by admin: defect)');
  console.log('   #9 DELIVERED  — Dimas (AirPods + PowerBank, J&T, paid OVO)');
  console.log('   #10 PACKING   — Rina (Galaxy Watch + 2x JBL, JNE, paid BNI VA)');

  // ==========================================
  // 8. CART ITEMS (active carts for 2 customers)
  // ==========================================
  await db.insert(cartItems).values([
    // Andi masih browsing
    { userId: 3, productId: 6, quantity: 1 },  // ASUS ROG
    { userId: 3, productId: 15, quantity: 2 },  // Charger Anker x2
    // Siti juga punya cart
    { userId: 4, productId: 11, quantity: 1 },  // Marshall Stanmore
    { userId: 4, productId: 14, quantity: 3 },  // PowerBank x3
  ]);
  console.log('🛒 4 cart items (Andi: 2 items, Siti: 2 items)');

  // ==========================================
  // 9. BANNERS (4 homepage banners)
  // ==========================================
  await db.insert(banners).values([
    {
      title: 'Flash Sale Gadget Terbaru',
      subtitle: 'Diskon hingga 50% untuk smartphone, laptop, dan aksesoris pilihan. Hanya hari ini!',
      image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1400&h=500&fit=crop',
      link: '/products',
      isActive: true,
      sortOrder: 1,
    },
    {
      title: 'iPhone 15 Pro Max',
      subtitle: 'Chip A17 Pro, kamera 48MP, titanium design. Tersedia dengan garansi resmi iBox.',
      image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=1400&h=500&fit=crop',
      link: '/products/iphone-15-pro-max',
      isActive: true,
      sortOrder: 2,
    },
    {
      title: 'MacBook Air M3 — Ringan & Powerful',
      subtitle: 'Laptop ultra-tipis dengan chip M3, baterai 18 jam. Sempurna untuk kerja dan kreativitas.',
      image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1400&h=500&fit=crop',
      link: '/products/macbook-air-m3',
      isActive: true,
      sortOrder: 3,
    },
    {
      title: 'Audio Premium Collection',
      subtitle: 'AirPods Pro, Sony WH-1000XM5, Marshall — pengalaman audio terbaik di kelasnya.',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1400&h=500&fit=crop',
      link: '/products?category=audio-headphone',
      isActive: true,
      sortOrder: 4,
    },
  ]);
  console.log('🖼️  4 banners created');

  console.log('\n✅ Seeding completed!\n');
  console.log('📊 Summary:');
  console.log('   Users:     5 (1 admin, 4 customers)');
  console.log('   Addresses: 6');
  console.log('   Products:  17 (16 active, 1 inactive)');
  console.log('   Orders:    10 (2 delivered, 1 shipping, 2 packing, 2 waiting, 1 expired, 2 cancelled)');
  console.log('   Invoices:  10');
  console.log('   Shippings: 10');
  console.log('   Cart:      4 items');
  console.log('\n🔑 Login:');
  console.log('   Admin:    admin@store.com / password123');
  console.log('   Customer: rina@gmail.com / password123');
  console.log('   Customer: andi.saputra@gmail.com / password123');
  console.log('   Customer: siti.nur@yahoo.com / password123');
  console.log('   Customer: dimas.p@gmail.com / password123');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
