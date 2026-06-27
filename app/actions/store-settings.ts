'use server';

import { db } from '@/lib/db';
import { storeSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

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
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menyimpan pengaturan' };
  }
}
