import { db } from "@/lib/db";
import { productBarcodes } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function setPrimaryBarcode(productId: number, variantId: number | null, rawCode?: string | null) {
  const code = rawCode?.trim() || null;
  if (code && (code.length > 100 || /\s/.test(code))) {
    throw new Error("Barcode maksimal 100 karakter dan tidak boleh mengandung spasi");
  }
  const condition = variantId
    ? and(eq(productBarcodes.productId, productId), eq(productBarcodes.variantId, variantId))
    : and(eq(productBarcodes.productId, productId), isNull(productBarcodes.variantId));
  const existing = await db.select({ id: productBarcodes.id, code: productBarcodes.code })
    .from(productBarcodes).where(condition).limit(1);

  if (!code) {
    if (existing[0]) await db.delete(productBarcodes).where(eq(productBarcodes.id, existing[0].id));
    return;
  }
  if (existing[0]?.code === code) return;

  const duplicate = await db.select({ id: productBarcodes.id }).from(productBarcodes)
    .where(eq(productBarcodes.code, code)).limit(1);
  if (duplicate[0] && duplicate[0].id !== existing[0]?.id) {
    throw new Error(`Barcode ${code} sudah digunakan produk atau varian lain`);
  }
  if (existing[0]) await db.update(productBarcodes).set({ code }).where(eq(productBarcodes.id, existing[0].id));
  else await db.insert(productBarcodes).values({ code, productId, variantId });
}

export async function assertBarcodeAvailable(rawCode?: string | null, owner?: { productId: number; variantId: number | null }) {
  const code = rawCode?.trim();
  if (!code) return;
  if (code.length > 100 || /\s/.test(code)) throw new Error("Barcode maksimal 100 karakter dan tidak boleh mengandung spasi");
  const rows = await db.select({ productId: productBarcodes.productId, variantId: productBarcodes.variantId })
    .from(productBarcodes).where(eq(productBarcodes.code, code)).limit(1);
  const existing = rows[0];
  if (existing && (!owner || existing.productId !== owner.productId || existing.variantId !== owner.variantId)) {
    throw new Error(`Barcode ${code} sudah digunakan produk atau varian lain`);
  }
}

export async function getProductBarcodeRows(productId: number) {
  return db.select().from(productBarcodes).where(eq(productBarcodes.productId, productId));
}
