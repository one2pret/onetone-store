"use server";

// app/actions/pos-settings.ts
// Settings khusus POS: gambar QRIS statis + identitas struk.
// QRIS di-upload ke R2 (reuse lib/storage), key-nya disimpan di store_settings.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";
import { storage, generateObjectKey } from "@/lib/storage";
import { detectMimeFromBuffer, processProductImage, validateImageBuffer } from "@/lib/image-processor";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const KEY_QRIS = "pos_qris_object_key";
const KEY_FOOTER = "pos_receipt_footer";
const KEY_RECEIPT_LOGO = "pos_receipt_logo_object_key";
const KEY_RECEIPT_NAME = "pos_receipt_store_name";
const KEY_RECEIPT_PHONE = "pos_receipt_store_phone";
const KEY_RECEIPT_ADDRESS = "pos_receipt_store_address";

const receiptSettingsSchema = z.object({
  storeName: z.string().trim().min(1, "Nama toko pada struk wajib diisi").max(80, "Nama toko maksimal 80 karakter"),
  storePhone: z.string().trim().max(50, "Nomor telepon maksimal 50 karakter"),
  storeAddress: z.string().trim().max(300, "Alamat maksimal 300 karakter"),
  receiptFooter: z.string().trim().max(500, "Footer maksimal 500 karakter"),
});

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "admin") {
    return { ok: false as const, error: "Hanya admin yang dapat mengubah pengaturan" };
  }
  return { ok: true as const };
}

async function upsertSetting(key: string, value: string) {
  const existing = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, key))
    .limit(1);
  if (existing.length > 0) {
    await db.update(storeSettings).set({ value }).where(eq(storeSettings.key, key));
  } else {
    await db.insert(storeSettings).values({ key, value });
  }
}

function revalidatePosSettings() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/pos");
  revalidatePath("/pos/test-print");
}

// ─── Get settings (public — dipakai di PaymentSheet & ReceiptView) ────────────

export async function getPosSettings(): Promise<{
  qrisUrl: string | null;
  receiptFooter: string | null;
  storeName: string | null;
  storePhone: string | null;
  storeAddress: string | null;
  receiptLogoUrl: string | null;
}> {
  const rows = await db.select().from(storeSettings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const qrisKey = map.get(KEY_QRIS);
  const receiptLogoKey = map.get(KEY_RECEIPT_LOGO);
  const receiptValue = (receiptKey: string, fallbackKey: string) =>
    map.has(receiptKey) ? (map.get(receiptKey) ?? null) : (map.get(fallbackKey) ?? null);
  return {
    qrisUrl: qrisKey ? storage.getUrl(qrisKey) : null,
    receiptFooter: map.get(KEY_FOOTER) ?? null,
    storeName: receiptValue(KEY_RECEIPT_NAME, "store_name"),
    storePhone: receiptValue(KEY_RECEIPT_PHONE, "store_phone"),
    storeAddress: receiptValue(KEY_RECEIPT_ADDRESS, "store_address"),
    receiptLogoUrl: receiptLogoKey ? storage.getUrl(receiptLogoKey) : null,
  };
}

// ─── Upload QRIS image ────────────────────────────────────────────────────────

export async function uploadPosQris(formData: FormData) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    return { success: false, error: "File tidak ditemukan" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    validateImageBuffer(buffer);
    const mime = detectMimeFromBuffer(buffer);
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";

    // Hapus QRIS lama kalau ada
    const oldRow = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, KEY_QRIS))
      .limit(1);
    if (oldRow[0]?.value) {
      try {
        await storage.delete(oldRow[0].value);
      } catch {
        /* ignore */
      }
    }

    // Upload baru
    const objectKey = generateObjectKey("pos", ext);
    const result = await storage.upload(objectKey, buffer, mime);

    await upsertSetting(KEY_QRIS, result.objectKey);

    revalidatePosSettings();
    return { success: true, url: result.url };
  } catch (err) {
    console.error("[uploadPosQris]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal upload QRIS",
    };
  }
}

// ─── Remove QRIS image ────────────────────────────────────────────────────────

export async function removePosQris() {
  const authResult = await requireAdmin();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const oldRow = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, KEY_QRIS))
    .limit(1);
  if (oldRow[0]?.value) {
    try {
      await storage.delete(oldRow[0].value);
    } catch {
      /* ignore */
    }
    await db.delete(storeSettings).where(eq(storeSettings.key, KEY_QRIS));
  }

  revalidatePosSettings();
  return { success: true };
}

// ─── Receipt identity & logo ────────────────────────────────────────────────

export async function updateReceiptSettings(input: {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  receiptFooter: string;
}) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const parsed = receiptSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Pengaturan struk tidak valid" };
  }

  try {
    await Promise.all([
      upsertSetting(KEY_RECEIPT_NAME, parsed.data.storeName),
      upsertSetting(KEY_RECEIPT_PHONE, parsed.data.storePhone),
      upsertSetting(KEY_RECEIPT_ADDRESS, parsed.data.storeAddress),
      upsertSetting(KEY_FOOTER, parsed.data.receiptFooter),
    ]);
    revalidatePosSettings();
    return { success: true };
  } catch (error) {
    console.error("[updateReceiptSettings]", error);
    return { success: false, error: "Gagal menyimpan pengaturan struk" };
  }
}

export async function uploadReceiptLogo(formData: FormData) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return { success: false, error: "File tidak ditemukan" };

  let newObjectKey: string | null = null;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processProductImage(buffer);
    newObjectKey = generateObjectKey("pos/receipt-logo", "webp");
    const uploaded = await storage.upload(newObjectKey, processed.main.buffer, "image/webp");

    const oldRows = await db.select({ value: storeSettings.value }).from(storeSettings)
      .where(eq(storeSettings.key, KEY_RECEIPT_LOGO)).limit(1);
    await upsertSetting(KEY_RECEIPT_LOGO, uploaded.objectKey);

    if (oldRows[0]?.value && oldRows[0].value !== uploaded.objectKey) {
      await storage.delete(oldRows[0].value).catch(() => undefined);
    }
    revalidatePosSettings();
    return { success: true, url: uploaded.url };
  } catch (error) {
    if (newObjectKey) await storage.delete(newObjectKey).catch(() => undefined);
    console.error("[uploadReceiptLogo]", error);
    return { success: false, error: error instanceof Error ? error.message : "Gagal mengupload logo struk" };
  }
}

export async function removeReceiptLogo() {
  const authResult = await requireAdmin();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const oldRows = await db.select({ value: storeSettings.value }).from(storeSettings)
    .where(eq(storeSettings.key, KEY_RECEIPT_LOGO)).limit(1);
  await db.delete(storeSettings).where(eq(storeSettings.key, KEY_RECEIPT_LOGO));
  if (oldRows[0]?.value) await storage.delete(oldRows[0].value).catch(() => undefined);
  revalidatePosSettings();
  return { success: true };
}
