"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { productBarcodes, products, productVariants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { assertBarcodeAvailable } from "@/lib/product-barcodes";

const barcodeSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable(),
  code: z.string().trim().min(3).max(100).regex(/^\S+$/, "Barcode tidak boleh mengandung spasi"),
});

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export async function addAdditionalProductBarcode(input: z.input<typeof barcodeSchema>) {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };
  const parsed = barcodeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Barcode tidak valid" };
  const data = parsed.data;

  const product = await db.select({ id: products.id }).from(products).where(eq(products.id, data.productId)).limit(1);
  if (!product[0]) return { success: false, error: "Produk tidak ditemukan" };
  if (data.variantId) {
    const variant = await db.select({ productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, data.variantId)).limit(1);
    if (!variant[0] || variant[0].productId !== data.productId) return { success: false, error: "Varian bukan milik produk ini" };
  }

  try {
    await assertBarcodeAvailable(data.code);
    await db.insert(productBarcodes).values(data);
    revalidatePath(`/dashboard/products/${data.productId}/edit`);
    revalidatePath("/dashboard/products");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal menambahkan barcode" };
  }
}

export async function deleteAdditionalProductBarcode(barcodeId: number, productId: number) {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };
  if (!Number.isSafeInteger(barcodeId) || !Number.isSafeInteger(productId)) return { success: false, error: "Data tidak valid" };
  const row = await db.select({ productId: productBarcodes.productId }).from(productBarcodes).where(eq(productBarcodes.id, barcodeId)).limit(1);
  if (!row[0] || row[0].productId !== productId) return { success: false, error: "Barcode tidak ditemukan" };
  await db.delete(productBarcodes).where(eq(productBarcodes.id, barcodeId));
  revalidatePath(`/dashboard/products/${productId}/edit`);
  revalidatePath("/dashboard/products");
  return { success: true };
}
