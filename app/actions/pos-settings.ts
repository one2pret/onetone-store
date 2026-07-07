"use server";

// app/actions/pos-settings.ts
// Settings khusus POS: gambar QRIS statis + footer struk.
// QRIS di-upload ke R2 (reuse lib/storage), key-nya disimpan di store_settings.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { storeSettings } from "@/lib/db/schema";
import { storage, generateObjectKey } from "@/lib/storage";
import { detectMimeFromBuffer, validateImageBuffer } from "@/lib/image-processor";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const KEY_QRIS = "pos_qris_object_key";
const KEY_FOOTER = "pos_receipt_footer";

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

// ─── Get settings (public — dipakai di PaymentSheet & ReceiptView) ────────────

export async function getPosSettings(): Promise<{
  qrisUrl: string | null;
  receiptFooter: string | null;
}> {
  const rows = await db.select().from(storeSettings);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const qrisKey = map.get(KEY_QRIS);
  return {
    qrisUrl: qrisKey ? storage.getUrl(qrisKey) : null,
    receiptFooter: map.get(KEY_FOOTER) ?? null,
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

    revalidatePath("/dashboard/settings");
    revalidatePath("/pos");
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

  revalidatePath("/dashboard/settings");
  revalidatePath("/pos");
  return { success: true };
}

// ─── Update receipt footer ────────────────────────────────────────────────────

export async function updateReceiptFooter(footer: string) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const trimmed = footer.trim();
  if (trimmed.length > 500) {
    return { success: false, error: "Footer maksimal 500 karakter" };
  }

  if (trimmed === "") {
    await db.delete(storeSettings).where(eq(storeSettings.key, KEY_FOOTER));
  } else {
    await upsertSetting(KEY_FOOTER, trimmed);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/pos");
  return { success: true };
}
