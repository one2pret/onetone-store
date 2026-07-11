"use server";

// app/actions/editorial-settings.ts
// Pengaturan editorial break section di landing (#1 & #2).
// Reuse store_settings key-value + R2 upload lewat lib/storage.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { storeSettings, products } from "@/lib/db/schema";
import { storage, generateObjectKey } from "@/lib/storage";
import { detectMimeFromBuffer, validateImageBuffer } from "@/lib/image-processor";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStoreSettings } from "@/app/actions/store-settings";
import { getFeaturedProducts, getBestSellerProducts } from "@/app/actions/products";

export type EditorialMode = "auto" | "product" | "upload" | "url";

export interface EditorialCopy {
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface EditorialBreakConfig {
  index: 1 | 2;
  mode: EditorialMode;
  productId: number | null;
  objectKey: string;
  imageUrl: string;
  copy: EditorialCopy;
  /** Copy override apa adanya dari admin (string kosong = pakai default) */
  copyOverride: Partial<EditorialCopy>;
  /** URL image final yang siap dipakai ke <Image src=...> */
  resolvedImageUrl: string | null;
  /** Layout reverse (image kanan) — hardcoded per index */
  reverse: boolean;
}

const DEFAULT_COPY: Record<1 | 2, EditorialCopy> = {
  1: {
    eyebrow: "Koleksi Baru",
    title: "Musim ini, siluet lebih tegas.",
    body: "Bahan yang bergerak bersama tubuh. Warna yang tenang dipilih untuk tetap relevan di luar musim. Diproduksi dalam jumlah terbatas.",
    ctaLabel: "Jelajahi New Arrival",
    ctaHref: "/products?sort=newest",
  },
  2: {
    eyebrow: "Untuk Setiap Hari",
    title: "Dipakai di gym, nyaman ke coffee shop.",
    body: "Bahan cepat kering, jahitan flat-lock, potongan yang tetap rapi setelah dicuci berkali-kali. Rutinitas aktif tanpa berganti outfit.",
    ctaLabel: "Lihat Koleksi Olahraga",
    ctaHref: "/products?category=olahraga",
  },
};

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

async function deleteSetting(key: string) {
  await db.delete(storeSettings).where(eq(storeSettings.key, key));
}

function keys(index: 1 | 2) {
  return {
    mode: `editorial_${index}_mode`,
    productId: `editorial_${index}_product_id`,
    objectKey: `editorial_${index}_object_key`,
    imageUrl: `editorial_${index}_image_url`,
    eyebrow: `editorial_${index}_eyebrow`,
    title: `editorial_${index}_title`,
    body: `editorial_${index}_body`,
    ctaLabel: `editorial_${index}_cta_label`,
    ctaHref: `editorial_${index}_cta_href`,
  };
}

async function resolveAutoImage(index: 1 | 2): Promise<string | null> {
  if (index === 1) {
    const featured = await getFeaturedProducts(2);
    // pakai index 1 (product #2 dari featured), fallback ke index 0
    return featured[1]?.image ?? featured[0]?.image ?? null;
  } else {
    const bestSeller = await getBestSellerProducts(1);
    return bestSeller[0]?.image ?? null;
  }
}

async function resolveProductImage(productId: number): Promise<{ url: string | null; name: string | null }> {
  const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const p = rows[0];
  if (!p) return { url: null, name: null };
  return { url: p.image, name: p.name };
}

export async function getEditorialBreak(index: 1 | 2): Promise<EditorialBreakConfig> {
  const settings = await getStoreSettings();
  const k = keys(index);
  const envOverride = index === 1
    ? process.env.NEXT_PUBLIC_EDITORIAL_1_URL
    : process.env.NEXT_PUBLIC_EDITORIAL_2_URL;

  const mode = (settings[k.mode] as EditorialMode) || "auto";
  const rawProductId = settings[k.productId];
  const productId = rawProductId ? Number(rawProductId) : null;
  const objectKey = settings[k.objectKey] || "";
  const imageUrl = settings[k.imageUrl] || "";

  const copyOverride: Partial<EditorialCopy> = {
    eyebrow: settings[k.eyebrow] || "",
    title: settings[k.title] || "",
    body: settings[k.body] || "",
    ctaLabel: settings[k.ctaLabel] || "",
    ctaHref: settings[k.ctaHref] || "",
  };

  const defaultCopy = DEFAULT_COPY[index];
  const copy: EditorialCopy = {
    eyebrow: copyOverride.eyebrow || defaultCopy.eyebrow,
    title: copyOverride.title || defaultCopy.title,
    body: copyOverride.body || defaultCopy.body,
    ctaLabel: copyOverride.ctaLabel || defaultCopy.ctaLabel,
    ctaHref: copyOverride.ctaHref || defaultCopy.ctaHref,
  };

  let resolvedImageUrl: string | null = null;
  if (envOverride) {
    resolvedImageUrl = envOverride;
  } else if (mode === "url" && imageUrl) {
    resolvedImageUrl = imageUrl;
  } else if (mode === "upload" && objectKey) {
    resolvedImageUrl = storage.getUrl(objectKey);
  } else if (mode === "product" && productId) {
    const { url } = await resolveProductImage(productId);
    resolvedImageUrl = url;
  } else {
    // auto default
    resolvedImageUrl = await resolveAutoImage(index);
  }

  return {
    index,
    mode,
    productId,
    objectKey,
    imageUrl,
    copy,
    copyOverride,
    resolvedImageUrl,
    reverse: index === 2,
  };
}

export async function getEditorialBreaks(): Promise<[EditorialBreakConfig, EditorialBreakConfig]> {
  const [b1, b2] = await Promise.all([getEditorialBreak(1), getEditorialBreak(2)]);
  return [b1, b2];
}

// ─── Save mode + product id + URL + copy overrides ─────────────────────────

export async function upsertEditorialConfig(index: 1 | 2, input: {
  mode: EditorialMode;
  productId?: string;
  imageUrl?: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const k = keys(index);
  try {
    await upsertSetting(k.mode, input.mode);
    await upsertSetting(k.productId, input.mode === "product" ? (input.productId || "") : "");
    await upsertSetting(k.imageUrl, input.mode === "url" ? (input.imageUrl?.trim() || "") : "");
    await upsertSetting(k.eyebrow, input.eyebrow?.trim() || "");
    await upsertSetting(k.title, input.title?.trim() || "");
    await upsertSetting(k.body, input.body?.trim() || "");
    await upsertSetting(k.ctaLabel, input.ctaLabel?.trim() || "");
    await upsertSetting(k.ctaHref, input.ctaHref?.trim() || "");

    revalidatePath("/dashboard/settings");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("[upsertEditorialConfig]", err);
    return { success: false, error: "Gagal menyimpan pengaturan editorial" };
  }
}

// ─── Upload image ke R2 ────────────────────────────────────────────────────

export async function uploadEditorialImage(index: 1 | 2, formData: FormData) {
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

    const k = keys(index);

    // Hapus image lama kalau ada
    const oldRow = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, k.objectKey))
      .limit(1);
    if (oldRow[0]?.value) {
      try {
        await storage.delete(oldRow[0].value);
      } catch {
        /* ignore */
      }
    }

    const objectKey = generateObjectKey(`editorial/${index}`, ext);
    const result = await storage.upload(objectKey, buffer, mime);

    await upsertSetting(k.objectKey, result.objectKey);
    // Auto-switch mode ke upload biar image langsung dipakai
    await upsertSetting(k.mode, "upload");

    revalidatePath("/dashboard/settings");
    revalidatePath("/");
    return { success: true, url: result.url, objectKey: result.objectKey };
  } catch (err) {
    console.error("[uploadEditorialImage]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal upload gambar",
    };
  }
}

// ─── Remove uploaded image ─────────────────────────────────────────────────

export async function removeEditorialImage(index: 1 | 2) {
  const authResult = await requireAdmin();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const k = keys(index);
  const oldRow = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, k.objectKey))
    .limit(1);
  if (oldRow[0]?.value) {
    try {
      await storage.delete(oldRow[0].value);
    } catch {
      /* ignore */
    }
    await deleteSetting(k.objectKey);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/");
  return { success: true };
}
