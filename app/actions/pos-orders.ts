"use server";

// app/actions/pos-orders.ts
// createPosOrder — transaksi offline kasir. Reuse validateStock & deductStock
// dari lib/stock.ts persis seperti createOrder online, tapi tanpa alamat/kurir/invoice.

import { db } from "@/lib/db";
import {
  orders,
  orderItems,
  products,
  productVariants,
  posSessions,
  posCustomerLeads,
  memberships,
  users,
  productImages,
  userVouchers,
  vouchers,
} from "@/lib/db/schema";
import { deductLocationStock, getLocationBalanceMap, validateLocationStock } from "@/lib/inventory-stock";
import { canAccessPosSession, requirePosOperator } from "@/lib/pos-auth";
import { calculatePosDiscountPricing, type PosDiscount } from "@/lib/pos-discounts";
import { awardPosOrderPoints } from "@/lib/pos-membership-points";
import { storage } from "@/lib/storage";
import { preferredProductImageKey, selectProductImage } from "@/lib/product-image-resolution";
import { resolveProductPrice } from "@/lib/product-pricing";
import { validatePosMemberVoucher } from "@/lib/pos-vouchers";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schema ───────────────────────────────────────────────────────────────────

const discountSchema = z.object({
  type: z.enum(["percent", "fixed"]),
  value: z.number().finite().positive("Diskon harus lebih dari 0"),
});

const cartItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().min(1, "Minimal 1 item"),
  discount: discountSchema.optional(),
});

const createPosOrderSchema = z.object({
  sessionId: z.number().int().positive(),
  items: z.array(cartItemSchema).min(1, "Keranjang kosong"),
  paymentMethod: z.enum(["cash", "qris", "transfer"]),
  cashReceived: z.number().min(0).optional(),
  customerUserId: z.number().int().positive().optional(),
  customerLeadId: z.number().int().positive().optional(),
  customerName: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
  orderDiscount: discountSchema.optional(),
  userVoucherId: z.number().int().positive().optional(),
}).refine(data => !(data.customerUserId && data.customerLeadId), {
  message: "Pilih member atau calon member, bukan keduanya",
}).refine(data => !data.userVoucherId || Boolean(data.customerUserId), {
  message: "Pilih member sebelum menggunakan voucher",
}).refine(data => !data.userVoucherId || (!data.orderDiscount && data.items.every(item => !item.discount)), {
  message: "Voucher tidak dapat digabung dengan diskon manual kasir",
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

// ─── createPosOrder ───────────────────────────────────────────────────────────

export async function createPosOrder(input: {
  sessionId: number;
  items: { productId: number; variantId?: number; quantity: number; discount?: PosDiscount }[];
  paymentMethod: "cash" | "qris" | "transfer";
  cashReceived?: number;
  customerUserId?: number;
  customerLeadId?: number;
  customerName?: string;
  notes?: string;
  orderDiscount?: PosDiscount;
  userVoucherId?: number;
}) {
  const authResult = await requirePosOperator();
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
  if (session.cashierId !== authResult.actor.id) {
    return { success: false, error: "Sesi kasir bukan milikmu" };
  }

  // Member dari client selalu divalidasi ulang. Hanya customer aktif yang
  // memiliki membership yang boleh ditautkan ke transaksi POS.
  let memberCustomer: { id: number; name: string } | null = null;
  if (data.customerUserId) {
    const memberRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(and(
        eq(users.id, data.customerUserId),
        eq(users.role, "customer"),
        isNull(users.deletedAt),
      ))
      .limit(1);
    memberCustomer = memberRows[0] ?? null;
    if (!memberCustomer) {
      return { success: false, error: "Member tidak ditemukan atau tidak aktif" };
    }
  }

  let leadCustomer: { id: number; name: string } | null = null;
  if (data.customerLeadId) {
    const leadRows = await db
      .select({ id: posCustomerLeads.id, name: posCustomerLeads.name })
      .from(posCustomerLeads)
      .where(and(
        eq(posCustomerLeads.id, data.customerLeadId),
        eq(posCustomerLeads.status, "pending"),
        isNull(posCustomerLeads.claimedUserId),
      ))
      .limit(1);
    leadCustomer = leadRows[0] ?? null;
    if (!leadCustomer) {
      return { success: false, error: "Calon member tidak ditemukan atau sudah diaktivasi" };
    }
  }

  // 2. Ambil detail produk + varian (untuk harga, nama, snapshot)
  const enrichment = await Promise.all(
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
        if (variantRow.length === 0 || variantRow[0].productId !== product.id) {
          throw new Error(`Varian ID ${item.variantId} tidak ditemukan`);
        }
        variant = variantRow[0];
      }

      const productPricing = resolveProductPrice({
        price: product.price,
        salePrice: product.salePrice,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
        saleChannel: product.saleChannel,
        pricingChannel: 'pos',
        priceModifier: variant?.priceModifier,
        variantSalePriceOverride: variant?.salePriceOverride,
      });
      const unitPrice = productPricing.finalPrice;
      const imageRows = await db.query.productImages.findMany({
        where: eq(productImages.productId, product.id),
      });
      const selectedImage = selectProductImage(imageRows, variant);
      const selectedImageKey = preferredProductImageKey(selectedImage);

      return {
        productId: product.id,
        variantId: variant?.id,
        quantity: item.quantity,
        productName: product.posName?.trim() || product.name,
        productImage: selectedImageKey ? storage.getUrl(selectedImageKey) : product.image,
        variantLabel: variant ? (variant.posLabel?.trim() || `${variant.size} / ${variant.color}`) : null,
        unitPrice,
        regularUnitPrice: productPricing.regularPrice,
        automaticDiscountAmount: productPricing.discountAmount,
        subtotal: unitPrice * item.quantity,
        discount: item.discount,
      };
    })
  ).then(items => ({ items })).catch(error => ({
    error: error instanceof Error ? error.message : "Produk atau varian tidak valid",
  }));
  if ("error" in enrichment) return { success: false, error: enrichment.error };
  const enriched = enrichment.items;

  // 3. Validasi stok — reuse fungsi yang sama dengan checkout online
  if (!session.locationId) return { success: false, error: "Sesi POS belum memiliki lokasi stok" };
  const locationId = session.locationId;
  const stockResult = await validateLocationStock(locationId,
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

  // 4. Hitung ulang diskon dari harga database. Kasir dibatasi 20%; admin dapat
  //    memberi override sampai 100%. Batas berlaku gabungan item + transaksi.
  const maxDiscountPercent = authResult.actor.role === "admin" ? 100 : 20;
  let pricing;
  try {
    pricing = calculatePosDiscountPricing(
      enriched.map((item, index) => ({
        key: String(index),
        unitPrice: item.unitPrice,
        regularUnitPrice: item.regularUnitPrice,
        quantity: item.quantity,
        discount: item.discount,
      })),
      data.orderDiscount,
      maxDiscountPercent,
    );
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Diskon tidak valid" };
  }
  const subtotal = pricing.subtotal;
  let voucherValidation: Awaited<ReturnType<typeof validatePosMemberVoucher>> | null = null;
  if (data.userVoucherId && memberCustomer) {
    voucherValidation = await validatePosMemberVoucher(memberCustomer.id, data.userVoucherId, subtotal);
    if (!voucherValidation.valid) return { success: false, error: voucherValidation.error };
  }
  const voucherDiscountAmount = voucherValidation?.valid ? voucherValidation.discountAmount : 0;
  const discountTotal = pricing.discountTotal + voucherDiscountAmount;
  const total = pricing.total - voucherDiscountAmount;

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

  // 6. Order, klaim voucher, item, dan stok berada dalam satu transaksi.
  //    Update voucher bersyarat membuat dua kasir tidak dapat menukarkan grant
  //    yang sama pada waktu bersamaan.
  try {
    const orderId = await db.transaction(async (tx) => {
      const [orderResult] = await tx.insert(orders).values({
        userId: memberCustomer?.id ?? null,
        posCustomerLeadId: leadCustomer?.id ?? null,
        voucherId: voucherValidation?.valid ? voucherValidation.voucherId : null,
        orderNumber,
        channel: "pos",
        status: "delivered",
        subtotal: String(subtotal),
        discountAmount: String(discountTotal),
        shippingCost: "0",
        total: String(total),
        shippingAddress: null,
        shippingPhone: null,
        shippingName: memberCustomer?.name ?? leadCustomer?.name ?? data.customerName ?? null,
        notes: data.notes || null,
        posSessionId: data.sessionId,
        posPaymentMethod: data.paymentMethod,
        cashReceived: cashReceived !== undefined ? String(cashReceived) : null,
        cashChange: cashChange !== undefined ? String(cashChange) : null,
        paidAt: now,
        deliveredAt: now,
      });
      const createdOrderId = Number(orderResult.insertId);

      if (voucherValidation?.valid && memberCustomer) {
        const [claimResult] = await tx.update(userVouchers).set({
          status: "redeemed",
          redeemedOrderId: createdOrderId,
          redeemedAt: now,
          reservedOrderId: null,
          reservedAt: null,
        }).where(and(
          eq(userVouchers.id, voucherValidation.userVoucherId),
          eq(userVouchers.userId, memberCustomer.id),
          eq(userVouchers.status, "available"),
          or(isNull(userVouchers.expiresAt), sql`${userVouchers.expiresAt} >= ${now}`),
        ));
        if (!claimResult || claimResult.affectedRows !== 1) throw new Error("Voucher baru saja digunakan pada transaksi lain");

        const [quotaResult] = await tx.update(vouchers).set({
          usedCount: sql`coalesce(${vouchers.usedCount}, 0) + 1`,
        }).where(and(
          eq(vouchers.id, voucherValidation.voucherId),
          eq(vouchers.isActive, true),
          or(isNull(vouchers.quota), sql`coalesce(${vouchers.usedCount}, 0) < ${vouchers.quota}`),
        ));
        if (!quotaResult || quotaResult.affectedRows !== 1) throw new Error("Kuota voucher baru saja habis");
      }

      await tx.insert(orderItems).values(enriched.map((e, index) => {
        const lineDiscount = pricing.lineDiscounts.get(String(index)) ?? 0;
        return {
          orderId: createdOrderId,
          productId: e.productId,
          variantId: e.variantId ?? null,
          productName: e.productName,
          productImage: e.productImage,
          variantLabel: e.variantLabel,
          price: String(e.unitPrice),
          regularPrice: String(e.regularUnitPrice),
          productDiscountAmount: String(e.automaticDiscountAmount),
          manualDiscountAmount: String(lineDiscount / e.quantity),
          quantity: e.quantity,
          subtotal: String(e.subtotal - lineDiscount),
        };
      }));

      await deductLocationStock(locationId, enriched.map((e) => ({
        productId: e.productId,
        variantId: e.variantId,
        quantity: e.quantity,
      })), { type: "pos_sale", referenceId: createdOrderId, actorUserId: authResult.actor.id }, tx);
      return createdOrderId;
    });

    let pointsEarned = 0;
    if (memberCustomer && (!voucherValidation?.valid || voucherValidation.allowPoints)) {
      try {
        const reward = await awardPosOrderPoints(orderId, memberCustomer.id);
        pointsEarned = reward.pointsEarned;
      } catch (membershipError) {
        // Penjualan tetap sah; kegagalan benefit tidak boleh membuat kasir
        // mengulang pembayaran dan menciptakan order ganda.
        console.error("[createPosOrder:membership]", membershipError);
      }
    }

    revalidatePath("/pos");
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/products");
    revalidatePath("/account/membership");
    revalidatePath("/account/points");

    return {
      success: true,
      orderId,
      orderNumber,
      total,
      discountAmount: discountTotal,
      voucherDiscountAmount,
      cashReceived,
      cashChange,
      pointsEarned,
    };
  } catch (err) {
    console.error("[createPosOrder]", err);
    const message = err instanceof Error ? err.message : "Gagal membuat transaksi";
    return { success: false, error: message };
  }
}

// ─── getPosOrder (untuk halaman struk) ────────────────────────────────────────

export async function getPosOrder(orderId: number) {
  const authResult = await requirePosOperator();
  if (!authResult.ok) return null;

  const orderRows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.channel, "pos")))
    .limit(1);

  if (orderRows.length === 0) return null;
  const order = orderRows[0];

  if (!order.posSessionId) return null;
  const sessionRows = await db
    .select({ cashierId: posSessions.cashierId })
    .from(posSessions)
    .where(eq(posSessions.id, order.posSessionId))
    .limit(1);
  const posSession = sessionRows[0];
  if (!posSession || !canAccessPosSession(authResult.actor, posSession.cashierId)) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const voucherRows = order.voucherId
    ? await db.select({ code: vouchers.code }).from(vouchers).where(eq(vouchers.id, order.voucherId)).limit(1)
    : [];

  return { ...order, voucherCode: voucherRows[0]?.code ?? null, items };
}

// ─── getPosProducts (katalog kasir) ───────────────────────────────────────────

/**
 * Produk untuk katalog POS. Include varian & kategori.
 * Hanya produk aktif + stok > 0 (produk tanpa varian) atau varian aktif.
 */
export async function getPosProducts(locationId?: number) {
  const authResult = await requirePosOperator();
  if (!authResult.ok) return [];

  if (!locationId) return [];
  const rows = await db.query.products.findMany({
    where: eq(products.isActive, true),
    with: {
      category: true,
      variants: {
        where: eq(productVariants.isActive, true),
        with: { barcodes: true },
      },
      images: true,
      barcodes: true,
    },
    orderBy: (products, { asc }) => [asc(products.name)],
  });

  // Untuk POS: pakai thumb (400px) — hemat ~4x bandwidth R2 vs main (800px).
  // Varian: exact variantId → legacy color → primary → first → products.image.
  const balances = await getLocationBalanceMap(locationId);
  const pricingNow = new Date();
  return rows.map((p) => {
    const { images, ...product } = p;
    const productImage = selectProductImage(images);
    const productImageKey = preferredProductImageKey(productImage);
    const productImageUrl = productImageKey ? storage.getUrl(productImageKey) : p.image;
    const productPricing = resolveProductPrice({
      price: p.price,
      salePrice: p.salePrice,
      saleStartsAt: p.saleStartsAt,
      saleEndsAt: p.saleEndsAt,
      saleChannel: p.saleChannel,
      pricingChannel: 'pos',
    }, pricingNow);

    return {
      ...product,
      stock: balances.get(`${p.id}:0`) ?? 0,
      variants: p.variants.map(variant => {
        const variantImage = selectProductImage(images, variant);
        const variantImageKey = preferredProductImageKey(variantImage);
        return {
          ...variant,
          stock: balances.get(`${p.id}:${variant.id}`) ?? 0,
          image: variantImageKey ? storage.getUrl(variantImageKey) : p.image,
          ...resolveProductPrice({
            price: p.price,
            salePrice: p.salePrice,
            saleStartsAt: p.saleStartsAt,
            saleEndsAt: p.saleEndsAt,
            saleChannel: p.saleChannel,
            pricingChannel: 'pos',
            priceModifier: variant.priceModifier,
            variantSalePriceOverride: variant.salePriceOverride,
          }, pricingNow),
        };
      }),
      image: productImageUrl,
      ...productPricing,
    };
  });
}

// ─── getRecentPosOrders (riwayat sesi ini) ────────────────────────────────────

export async function getRecentPosOrders(sessionId: number, limit = 20) {
  const authResult = await requirePosOperator();
  if (!authResult.ok) return [];

  const sessionRows = await db
    .select({ cashierId: posSessions.cashierId })
    .from(posSessions)
    .where(eq(posSessions.id, sessionId))
    .limit(1);
  const posSession = sessionRows[0];
  if (!posSession || !canAccessPosSession(authResult.actor, posSession.cashierId)) return [];

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
