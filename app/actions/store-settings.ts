'use server';

import { db } from '@/lib/db';
import { storeSettings, products } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getFeaturedProducts } from '@/app/actions/products';

export type HeroMode = 'auto' | 'product' | 'custom';

export interface HeroConfig {
  mode: HeroMode;
  imageUrl: string | null;
  caption: string | null;
  productId: number | null;
  customImageUrl: string;
}

export async function getStoreSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
  if (rows.length === 0) return null;
  return rows[0].value;
}

export async function getStoreSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(storeSettings);
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.value !== null) {
      result[row.key] = row.value;
    }
  }
  return result;
}

export async function upsertStoreSetting(key: string, value: string) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return { success: false, error: 'Hanya admin yang dapat mengubah pengaturan' };
  }

  try {
    const existing = await db.select().from(storeSettings)
      .where(eq(storeSettings.key, key)).limit(1);

    if (existing.length > 0) {
      await db.update(storeSettings)
        .set({ value })
        .where(eq(storeSettings.key, key));
    } else {
      await db.insert(storeSettings).values({ key, value });
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/');
    revalidatePath('/contact');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menyimpan pengaturan' };
  }
}

/**
 * Resolve hero image untuk landing page.
 * Priority: env override > custom URL > selected product > auto (featured[0]).
 */
export async function getHeroConfig(): Promise<HeroConfig> {
  const envOverride = process.env.NEXT_PUBLIC_HERO_IMAGE_URL;

  const settings = await getStoreSettings();
  const mode = (settings.hero_mode as HeroMode) || 'auto';
  const rawProductId = settings.hero_product_id;
  const customImageUrl = settings.hero_image_url || '';
  const productId = rawProductId ? Number(rawProductId) : null;

  // Env override wins (dev/staging bypass)
  if (envOverride) {
    return {
      mode,
      imageUrl: envOverride,
      caption: null,
      productId,
      customImageUrl,
    };
  }

  if (mode === 'custom' && customImageUrl) {
    return {
      mode,
      imageUrl: customImageUrl,
      caption: null,
      productId,
      customImageUrl,
    };
  }

  if (mode === 'product' && productId) {
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    const picked = rows[0];
    if (picked?.image) {
      return {
        mode,
        imageUrl: picked.image,
        caption: picked.name,
        productId,
        customImageUrl,
      };
    }
  }

  // auto (default): featured[0]
  const featured = await getFeaturedProducts(1);
  const hero = featured[0];
  return {
    mode,
    imageUrl: hero?.image ?? null,
    caption: hero?.name ?? null,
    productId,
    customImageUrl,
  };
}

export async function upsertStoreSettings(pairs: Record<string, string>) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return { success: false, error: 'Hanya admin yang dapat mengubah pengaturan' };
  }

  try {
    for (const [key, value] of Object.entries(pairs)) {
      const existing = await db.select().from(storeSettings)
        .where(eq(storeSettings.key, key)).limit(1);

      if (existing.length > 0) {
        await db.update(storeSettings)
          .set({ value })
          .where(eq(storeSettings.key, key));
      } else {
        await db.insert(storeSettings).values({ key, value });
      }
    }

    revalidatePath('/dashboard/settings');
    revalidatePath('/');
    revalidatePath('/contact');
    return { success: true };
  } catch (error) {
    console.error('upsertStoreSettings failed:', error);
    return { success: false, error: 'Gagal menyimpan pengaturan' };
  }
}
