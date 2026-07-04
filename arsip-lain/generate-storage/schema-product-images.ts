// Tambahkan ke lib/db/schema.ts
// Letakkan setelah definisi tabel `products`

import {
  mysqlTable,
  int,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/mysql-core";
import { relations, InferSelectModel, InferInsertModel } from "drizzle-orm";

// ─── Tabel product_images ──────────────────────────────────────────────────────

export const productImages = mysqlTable("product_images", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  
  // R2 storage — JANGAN simpan full URL di sini
  objectKey:        varchar("object_key", { length: 500 }).notNull(),
  objectKeyOriginal: varchar("object_key_original", { length: 500 }),
  objectKeyThumb:   varchar("object_key_thumb", { length: 500 }),

  // Metadata
  filenameOriginal: varchar("filename_original", { length: 255 }),
  mime:    varchar("mime", { length: 100 }).default("image/webp"),
  width:   int("width"),
  height:  int("height"),
  filesize: int("filesize"),
  checksum: varchar("checksum", { length: 64 }),

  // Ordering & primary flag
  sortOrder: int("sort_order").default(0),
  isPrimary: boolean("is_primary").default(false),

  createdAt: timestamp("created_at").defaultNow(),
});

export type ProductImage = InferSelectModel<typeof productImages>;
export type NewProductImage = InferInsertModel<typeof productImages>;

// ─── Update relasi di productsRelations ───────────────────────────────────────
// Tambahkan `images: many(productImages)` ke productsRelations yang sudah ada:
//
// export const productsRelations = relations(products, ({ one, many }) => ({
//   category: one(categories, { ... }),
//   orderItems: many(orderItems),
//   images: many(productImages),          // ← tambahkan ini
// }));
//
// Dan tambahkan relasi baru:
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));
