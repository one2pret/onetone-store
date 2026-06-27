# Sesi 02 — Database (MySQL + Drizzle ORM)

> ⏱️ Estimasi: 45 menit
> 🎯 Tujuan: Peserta paham schema database e-commerce, bisa setup Drizzle ORM, push schema ke MySQL, dan seed data.

---

## 1. Konsep (10 menit)

### Apa Itu ORM?
- **Object-Relational Mapping** — jembatan antara kode TypeScript dan database SQL
- Tanpa ORM: tulis SQL manual (`SELECT * FROM users WHERE id = ?`)
- Dengan ORM: tulis kode TypeScript (`db.select().from(users).where(eq(users.id, 1))`)

### Kenapa Drizzle (bukan Prisma)?
| Aspek | Drizzle | Prisma |
|-------|---------|--------|
| Type Safety | ✅ Inferred dari schema | ✅ Generated |
| Bundle Size | Kecil (~20kb) | Besar (Rust binary) |
| SQL-like API | ✅ Mirip SQL | ❌ Pakai abstraksi |
| Migration | ✅ Drizzle Kit | ✅ Prisma Migrate |
| Edge Compatible | ✅ | ❌ (sebagian) |

**Kesimpulan**: Drizzle = pilihan modern untuk Next.js 16 + edge runtime.

---

## 2. Setup MySQL Lokal

### Option A: Pakai Homebrew (Mac)
```bash
brew install mysql
brew services start mysql
mysql_secure_installation
```

### Option B: Pakai Docker
```bash
docker run --name mysql-olshop \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=next_olshop_db \
  -p 3306:3306 \
  -d mysql:8
```

### Option C: Pakai GUI (XAMPP / Laragon / DBngin)
- Install salah satu, start MySQL service
- Buat database `next_olshop_db` via phpMyAdmin

### Test Koneksi
```bash
mysql -u root -p
# Masukkan password
mysql> CREATE DATABASE IF NOT EXISTS next_olshop_db;
mysql> USE next_olshop_db;
mysql> SHOW TABLES;
```

---

## 3. Setup Drizzle

### Buat `drizzle.config.ts` di Root
```typescript
import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### Buat `lib/db/index.ts` — Koneksi Database
```typescript
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const poolConnection = mysql.createPool({
  uri: process.env.DATABASE_URL,
});

export const db = drizzle(poolConnection, { schema, mode: "default" });
```

---

## 4. Bikin Schema (FILE TERBESAR — Pelan-pelan!)

Buat `lib/db/schema.ts`. Ajarkan **per tabel**, jangan paste semua sekaligus.

### 4.1 Users
```typescript
import {
  mysqlTable, int, varchar, decimal, timestamp, text, boolean, mysqlEnum
} from "drizzle-orm/mysql-core";
import { relations, InferSelectModel, InferInsertModel } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  role: mysqlEnum("role", ["customer", "admin"]).default("customer"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
```

**Jelaskan**:
- `mysqlTable("users", {...})` — nama tabel di DB
- `int("id")` — column SQL pakai snake_case, di TS auto camelCase
- `.primaryKey().autoincrement()` — PK auto-increment
- `mysqlEnum` — restricted values (mirip enum SQL)
- `InferSelectModel` — type untuk hasil SELECT (Drizzle generate otomatis)

### 4.2 Categories
```typescript
export const categories = mysqlTable("categories", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  image: varchar("image", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Category = InferSelectModel<typeof categories>;
```

### 4.3 Products
```typescript
export const products = mysqlTable("products", {
  id: int("id").primaryKey().autoincrement(),
  categoryId: int("category_id").references(() => categories.id),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  stock: int("stock").default(0),
  weight: int("weight").default(0), // gram
  image: varchar("image", { length: 500 }),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export type Product = InferSelectModel<typeof products>;
```

**Penting**:
- `decimal("price", { precision: 12, scale: 2 })` — untuk uang, BUKAN float (presisi tepat)
- `weight` dalam gram (untuk Bitship)
- `categoryId` nullable — produk bisa tanpa kategori

### 4.4 Addresses (Customer punya banyak alamat)
```typescript
export const addresses = mysqlTable("addresses", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id).notNull(),
  label: varchar("label", { length: 100 }),
  recipientName: varchar("recipient_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  address: text("address").notNull(),
  province: varchar("province", { length: 255 }).notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  district: varchar("district", { length: 255 }).notNull(),
  postalCode: varchar("postal_code", { length: 10 }).notNull(),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Address = InferSelectModel<typeof addresses>;
```

### 4.5 Cart Items
```typescript
export const cartItems = mysqlTable("cart_items", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id).notNull(),
  productId: int("product_id").references(() => products.id).notNull(),
  quantity: int("quantity").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CartItem = InferSelectModel<typeof cartItems>;
```

### 4.6 Orders (Tabel Paling Kompleks)
```typescript
export const orders = mysqlTable("orders", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").references(() => users.id).notNull(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  status: mysqlEnum("status", [
    "waiting_payment", "packing", "shipping",
    "delivered", "expired", "cancelled"
  ]).default("waiting_payment").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),

  // Snapshot alamat (bukan FK, biar history utuh kalau alamat dihapus)
  shippingName: varchar("shipping_name", { length: 255 }).notNull(),
  shippingPhone: varchar("shipping_phone", { length: 20 }).notNull(),
  shippingAddress: text("shipping_address").notNull(),

  // Timestamps untuk audit
  willExpiredAt: timestamp("will_expired_at"),
  paidAt: timestamp("paid_at"),
  packingAt: timestamp("packing_at"),
  shippingAt: timestamp("shipping_at"),
  deliveredAt: timestamp("delivered_at"),
  expiredAt: timestamp("expired_at"),
  cancelledAt: timestamp("cancelled_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export type Order = InferSelectModel<typeof orders>;
```

### 4.7 Order Items
```typescript
export const orderItems = mysqlTable("order_items", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("order_id").references(() => orders.id).notNull(),
  productId: int("product_id").references(() => products.id),
  productName: varchar("product_name", { length: 255 }).notNull(), // snapshot
  productImage: varchar("product_image", { length: 500 }),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  quantity: int("quantity").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
});

export type OrderItem = InferSelectModel<typeof orderItems>;
```

**Penting**: snapshot `productName`, `price` — kalau produk dihapus/diubah harga, history order tetap utuh.

### 4.8 Invoices (Xendit)
```typescript
export const invoices = mysqlTable("invoices", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("order_id").references(() => orders.id).notNull(),
  xenditId: varchar("xendit_id", { length: 100 }),
  invoiceUrl: varchar("invoice_url", { length: 500 }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "paid", "expired", "cancelled"])
    .default("pending"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Invoice = InferSelectModel<typeof invoices>;
```

### 4.9 Shippings (Bitship)
```typescript
export const shippings = mysqlTable("shippings", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("order_id").references(() => orders.id).notNull(),
  trackingId: varchar("tracking_id", { length: 100 }),
  waybillId: varchar("waybill_id", { length: 100 }),
  courierCompany: varchar("courier_company", { length: 50 }),
  courierType: varchar("courier_type", { length: 50 }),
  price: decimal("price", { precision: 12, scale: 2 }),
  estimateDays: varchar("estimate_days", { length: 50 }),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Shipping = InferSelectModel<typeof shippings>;
```

### 4.10 Couriers, Store Settings, Audit Logs
Tambahkan tabel pelengkap (lihat `lib/db/schema.ts` lengkap di repo referensi).

---

## 5. Define Relations

Di akhir `schema.ts`, tambahkan:

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  cartItems: many(cartItems),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  invoices: many(invoices),
  shippings: many(shippings),
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
```

---

## 6. Push Schema ke Database

```bash
# Tambah script di package.json
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio",
```

Jalankan:
```bash
pnpm db:push
```

Output:
```
✓ Changes applied
```

### Verifikasi via Drizzle Studio
```bash
pnpm db:studio
```

Buka `https://local.drizzle.studio` — lihat semua tabel sudah ada.

---

## 7. Bikin Seed Data

Buat `lib/db/seed.ts`:

```typescript
import { db } from "./index";
import { users, categories, products } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding...");

  // 1. Users
  const hashedPassword = await bcrypt.hash("password123", 10);
  await db.insert(users).values([
    {
      name: "Admin Store",
      email: "admin@store.com",
      password: hashedPassword,
      role: "admin",
    },
    {
      name: "John Doe",
      email: "john@example.com",
      password: hashedPassword,
      role: "customer",
    },
  ]);
  console.log("✓ Users seeded");

  // 2. Categories
  await db.insert(categories).values([
    { name: "Elektronik", slug: "elektronik" },
    { name: "Fashion", slug: "fashion" },
    { name: "Makanan", slug: "makanan" },
  ]);
  console.log("✓ Categories seeded");

  // 3. Products
  await db.insert(products).values([
    {
      categoryId: 1,
      name: "Earbuds Wireless Pro",
      slug: "earbuds-wireless-pro",
      description: "Earbuds dengan noise cancellation",
      price: "299000.00",
      stock: 50,
      weight: 200,
      isActive: true,
      isFeatured: true,
    },
    {
      categoryId: 2,
      name: "Kaos Polos Premium",
      slug: "kaos-polos-premium",
      description: "Kaos katun combed 30s",
      price: "89000.00",
      stock: 100,
      weight: 250,
      isActive: true,
    },
  ]);
  console.log("✓ Products seeded");

  console.log("🎉 Seed done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
```

### Tambah Script
```json
"db:seed": "tsx --env-file=.env.local lib/db/seed.ts"
```

Jalankan:
```bash
pnpm db:seed
```

Verifikasi di Drizzle Studio — tabel `users`, `categories`, `products` harus ada datanya.

---

## 8. Latihan Query (Live Demo)

Buat file sementara `app/api/test/route.ts`:

```typescript
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  // Query 1: Semua produk aktif
  const all = await db.select().from(products).where(eq(products.isActive, true));

  // Query 2: Join dengan category
  const withCategory = await db.query.products.findMany({
    with: { category: true },
    where: eq(products.isActive, true),
  });

  return Response.json({ all, withCategory });
}
```

Test: buka `http://localhost:3000/api/test`

---

## ✅ Checklist Akhir Sesi 02

- [ ] MySQL running, database `next_olshop_db` ada
- [ ] `drizzle.config.ts` & `lib/db/index.ts` siap
- [ ] Schema 12 tabel selesai dibikin
- [ ] `pnpm db:push` sukses
- [ ] `pnpm db:seed` sukses
- [ ] Drizzle Studio bisa dibuka, data terlihat
- [ ] Query test API jalan

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL belum running |
| `Access denied for user` | Password salah di `DATABASE_URL` |
| `Unknown database 'next_olshop_db'` | Database belum dibuat — `CREATE DATABASE` dulu |
| `Cannot find module 'mysql2'` | `pnpm install` |
| `drizzle-kit: command not found` | `pnpm install -D drizzle-kit` |
| Schema push gagal: `Duplicate key` | Drop database, buat ulang, push lagi |

---

## ➡️ Lanjut ke [Sesi 03 — Authentication](./03-auth.md)
