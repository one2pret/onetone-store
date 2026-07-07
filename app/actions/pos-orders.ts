"use server";

// app/actions/pos-orders.ts
// createPosOrder — transaksi offline kasir. Reuse validateStock & deductStock
// dari lib/stock.ts persis seperti createOrder online, tapi tanpa alamat/kurir/invoice.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  orders,
  orderItems,
  products,
  productVariants,
  posSessions,
} from "@/lib/db/schema";
import { deductStock, validateStock } from "@/lib/stock";
import { storage } from "@/lib/storage";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────

const cartItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().min(1, "Minimal 1 item"),
});

const createPosOrderSchema = z.object({
  sessionId: z.number().int().positive(),
  items: z.array(cartItemSchema).min(1, "Keranjang kosong"),
  paymentMethod: z.enum(["cash", "qris", "transfer"]),
  cashReceived: z.number().min(0).optional(),
  customerName: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
});

// ─── Helper: order number POS ─────────────────────────────────────────────────

function generatePosOrderNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `POS-${y}${m}${day}-${random}`;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireCashier() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "admin") {
    return { ok: false as const, error: "Hanya admin yang dapat mengakses POS" };
  }
  return { ok: true as const, userId: Number(session.user.id) };
}

// ─── createPosOrder ───────────────────────────────────────────────────────────

export async function createPosOrder(input: {
  sessionId: number;
  items: { productId: number; variantId?: number; quantity: number }[];
  paymentMethod: "cash" | "qris" | "transfer";
  cashReceived?: number;
  customerName?: string;
  notes?: string;
}) {
  const authResult = await requireCashier();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const parsed = createPosOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const data = parsed.data;

  // 1. Validasi sesi kasir aktif
  const sessionRows = await db
    .select()
    .from(posSessions)
    .where(eq(posSessions.id, data.sessionId))
    .limit(1);

  if (sessionRows.length === 0) {
    return { success: false, error: "Sesi kasir tidak ditemukan" };
  }
  const session = sessionRows[0];
  if (session.status !== "open") {
    return { success: false, error: "Sesi kasir sudah ditutup" };
  }
  if (session.cashierId !== authResult.userId) {
    return { success: false, error: "Sesi kasir bukan milikmu" };
  }

  // 2. Ambil detail produk + varian (untuk harga, nama, snapshot)
  const enriched = await Promise.all(
    data.items.map(async (item) => {
      const productRow = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      if (productRow.length === 0) {
        throw new Error(`Produk ID ${item.productId} tidak ditemukan`);
      }
      const product = productRow[0];

      let variant: typeof productVariants.$inferSelect | null = null;
      if (item.variantId) {
        const variantRow = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, item.variantId))
          .limit(1);
        if (variantRow.length === 0) {
          throw new Error(`Varian ID ${item.variantId} tidak ditemukan`);
        }
        variant = variantRow[0];
      }

      const base = Number(product.price);
      const modifier = Number(variant?.priceModifier ?? 0);
      const unitPrice = base + modifier;

      return {
        productId: product.id,
        variantId: variant?.id,
        quantity: item.quantity,
        productName: product.name,
        productImage: product.image,
        variantLabel: variant ? `${variant.size} / ${variant.color}` : null,
        unitPrice,
        subtotal: unitPrice * item.quantity,
      };
    })
  );

  // 3. Validasi stok — reuse fungsi yang sama dengan checkout online
  const stockResult = await validateStock(
    enriched.map((e) => ({
      productId: e.productId,
      variantId: e.variantId,
      quantity: e.quantity,
      productName: e.productName + (e.variantLabel ? ` (${e.variantLabel})` : ""),
    }))
  );
  if (!stockResult.valid) {
    return { success: false, error: stockResult.errors.join(", ") };
  }

  // 4. Hitung total
  const subtotal = enriched.reduce((sum, e) => sum + e.subtotal, 0);
  const total = subtotal;

  // 5. Validasi pembayaran tunai
  let cashReceived: number | undefined;
  let cashChange: number | undefined;
  if (data.paymentMethod === "cash") {
    cashReceived = data.cashReceived ?? 0;
    if (cashReceived < total) {
      return {
        success: false,
        error: `Uang diterima (Rp${cashReceived.toLocaleString("id-ID")}) kurang dari total (Rp${total.toLocaleString("id-ID")})`,
      };
    }
    cashChange = cashReceived - total;
  }

  const orderNumber = generatePosOrderNumber();
  const now = new Date();

  // 6. Insert order + items + deduct stock — sequential (mysql2 pool tidak
  //    handle nested transaction dengan baik untuk semua workload). Karena
  //    stok validation sudah dijalankan tepat sebelum insert, race condition
  //    minimal — POS single-kasir per sesi.
  try {
    const [orderResult] = await db.insert(orders).values({
      userId: null, // walk-in customer — POS tidak butuh akun
      orderNumber,
      channel: "pos",
      status: "delivered", // langsung selesai (transaksi tatap muka)
      subtotal: String(subtotal),
      shippingCost: "0",
      total: String(total),
      shippingAddress: null,
      shippingPhone: null,
      shippingName: data.customerName || null,
      notes: data.notes || null,
      posSessionId: data.sessionId,
      posPaymentMethod: data.paymentMethod,
      cashReceived: cashReceived !== undefined ? String(cashReceived) : null,
      cashChange: cashChange !== undefined ? String(cashChange) : null,
      paidAt: now,
      deliveredAt: now,
    });

    const orderId = Number(orderResult.insertId);

    await db.insert(orderItems).values(
      enriched.map((e) => ({
        orderId,
        productId: e.productId,
        variantId: e.variantId ?? null,
        productName: e.productName,
        productImage: e.productImage,
        variantLabel: e.variantLabel,
        price: String(e.unitPrice),
        quantity: e.quantity,
        subtotal: String(e.subtotal),
      }))
    );

    // 7. Deduct stock — reuse helper yang sama dengan checkout online
    await deductStock(
      enriched.map((e) => ({
        productId: e.productId,
        variantId: e.variantId,
        quantity: e.quantity,
      }))
    );

    revalidatePath("/pos");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/products");

    return {
      success: true,
      orderId,
      orderNumber,
      total,
      cashReceived,
      cashChange,
    };
  } catch (err) {
    console.error("[createPosOrder]", err);
    const message = err instanceof Error ? err.message : "Gagal membuat transaksi";
    return { success: false, error: message };
  }
}

// ─── getPosOrder (untuk halaman struk) ────────────────────────────────────────

export async function getPosOrder(orderId: number) {
  const authResult = await requireCashier();
  if (!authResult.ok) return null;

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.channel, "pos")))
    .limit(1);

  if (orderRows.length === 0) return null;
  const order = orderRows[0];

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  return { ...order, items };
}

// ─── getPosProducts (katalog kasir) ───────────────────────────────────────────

/**
 * Produk untuk katalog POS. Include varian & kategori.
 * Hanya produk aktif + stok > 0 (produk tanpa varian) atau varian aktif.
 */
export async function getPosProducts() {
  const authResult = await requireCashier();
  if (!authResult.ok) return [];

  const rows = await db.query.products.findMany({
    where: eq(products.isActive, true),
    with: {
      category: true,
      variants: {
        where: eq(productVariants.isActive, true),
      },
      images: true,
    },
    orderBy: (products, { asc }) => [asc(products.name)],
  });

  // Untuk POS: pakai thumb (400px) — hemat ~4x bandwidth R2 vs main (800px).
  // Prioritas: primary image thumb → any thumb → products.image (fallback CDN).
  return rows.map((p) => {
    const primary = p.images.find((img) => img.isPrimary) ?? p.images[0];
    const thumbUrl = primary?.objectKeyThumb
      ? storage.getUrl(primary.objectKeyThumb)
      : primary?.objectKey
        ? storage.getUrl(primary.objectKey)
        : p.image; // last fallback: main CDN URL

    return {
      ...p,
      image: thumbUrl, // override dengan thumb untuk katalog POS
    };
  });
}

// ─── getRecentPosOrders (riwayat sesi ini) ────────────────────────────────────

export async function getRecentPosOrders(sessionId: number, limit = 20) {
  const authResult = await requireCashier();
  if (!authResult.ok) return [];

  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      total: orders.total,
      posPaymentMethod: orders.posPaymentMethod,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.posSessionId, sessionId), eq(orders.channel, "pos")))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
