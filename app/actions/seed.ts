// app/actions/seed.ts
'use server';

import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

const ONETONE_CATEGORIES = [
  {
    name: 'Pakaian Olahraga Wanita',
    slug: 'pakaian-olahraga-wanita',
    description: 'Koleksi pakaian olahraga wanita ONETONE: crop top, sports bra, legging, dan set gym.',
  },
  {
    name: 'Pakaian Olahraga Pria',
    slug: 'pakaian-olahraga-pria',
    description: 'Koleksi pakaian olahraga pria ONETONE: jersey, training shirt, shorts, dan set gym.',
  },
  {
    name: 'Pakaian Casual Wanita',
    slug: 'pakaian-casual-wanita',
    description: 'Koleksi pakaian casual wanita ONETONE: oversize tee, cardigan, dan atasan santai.',
  },
  {
    name: 'Pakaian Casual Pria',
    slug: 'pakaian-casual-pria',
    description: 'Koleksi pakaian casual pria ONETONE: kaos, kemeja casual, dan atasan santai.',
  },
  {
    name: 'Aksesoris',
    slug: 'aksesoris',
    description: 'Aksesoris pelengkap ONETONE: topi, tas gym, kaos kaki, dan aksesoris olahraga lainnya.',
  },
  {
    name: 'Bundle & Set',
    slug: 'bundle-set',
    description: 'Paket hemat set olahraga dan fashion ONETONE dengan harga spesial.',
  },
];

export async function seedCategories(): Promise<{ success: boolean; inserted: number; skipped: number; error?: string }> {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return { success: false, inserted: 0, skipped: 0, error: 'Unauthorized' };
  }

  let inserted = 0;
  let skipped = 0;

  for (const cat of ONETONE_CATEGORIES) {
    try {
      // Insert only if slug doesn't exist yet (safe to run multiple times)
      const existing = await db
        .select({ id: categories.id })
        .from(categories)
        .where(sql`${categories.slug} = ${cat.slug}`)
        .limit(1);

      if (existing.length > 0) {
        skipped++;
      } else {
        await db.insert(categories).values(cat);
        inserted++;
      }
    } catch {
      // skip on individual error
      skipped++;
    }
  }

  revalidatePath('/dashboard/categories');
  revalidatePath('/products');

  return { success: true, inserted, skipped };
}
