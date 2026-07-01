// app/actions/seed.ts
'use server';

import { db } from '@/lib/db';
import { categories, products } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { slugify } from '@/lib/utils';

// ============ SEED CATEGORIES ============
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
      skipped++;
    }
  }

  revalidatePath('/dashboard/categories');
  revalidatePath('/products');

  return { success: true, inserted, skipped };
}

// ============ SEED PRODUCTS ============
// Produk berdasarkan tipe nyata ONETONE dari Odoo
// Harga = PLACEHOLDER — edit via Dashboard > Produk
const ONETONE_PRODUCTS = [
  // --- Pakaian Olahraga Wanita ---
  {
    categorySlug: 'pakaian-olahraga-wanita',
    name: 'Legging Sports ONETONE',
    description: 'Legging olahraga wanita ONETONE berbahan premium stretch, nyaman untuk gym, yoga, dan aktivitas sehari-hari. Tersedia berbagai warna.',
    price: '89000',
    stock: 50,
    weight: 200,
    isFeatured: true,
    isActive: true,
    image: 'https://placehold.co/600x600/1a1a2e/ffffff?text=Legging+Sports',
  },
  {
    categorySlug: 'pakaian-olahraga-wanita',
    name: 'Legging Rok ONETONE',
    description: 'Legging rok sporty wanita ONETONE — kombinasi rok pendek dan legging untuk tampilan aktif yang tetap stylish.',
    price: '99000',
    stock: 40,
    weight: 220,
    isFeatured: false,
    isActive: true,
    image: 'https://placehold.co/600x600/16213e/ffffff?text=Legging+Rok',
  },
  {
    categorySlug: 'pakaian-olahraga-wanita',
    name: 'Rompi Crop ONETONE',
    description: 'Rompi crop sporty wanita ONETONE, cocok untuk layering outfit gym atau casual. Bahan ringan dan breathable.',
    price: '85000',
    stock: 35,
    weight: 150,
    isFeatured: false,
    isActive: true,
    image: 'https://placehold.co/600x600/0f3460/ffffff?text=Rompi+Crop',
  },
  {
    categorySlug: 'pakaian-olahraga-wanita',
    name: 'Abaya Sports ONETONE',
    description: 'Abaya sports wanita ONETONE — pilihan modest activewear yang tetap sporty dan nyaman untuk aktivitas fisik.',
    price: '175000',
    stock: 25,
    weight: 450,
    isFeatured: true,
    isActive: true,
    image: 'https://placehold.co/600x600/533483/ffffff?text=Abaya+Sports',
  },
  // --- Pakaian Olahraga Pria ---
  {
    categorySlug: 'pakaian-olahraga-pria',
    name: 'Kaos Sports ONETONE',
    description: 'Kaos olahraga pria ONETONE berbahan dri-fit, menyerap keringat cepat, cocok untuk gym, lari, dan olahraga outdoor.',
    price: '75000',
    stock: 60,
    weight: 180,
    isFeatured: true,
    isActive: true,
    image: 'https://placehold.co/600x600/1b4332/ffffff?text=Kaos+Sports',
  },
  {
    categorySlug: 'pakaian-olahraga-pria',
    name: 'Jaket Sports ONETONE',
    description: 'Jaket olahraga pria ONETONE ringan dan windproof, desain modern untuk gym maupun aktivitas outdoor.',
    price: '165000',
    stock: 30,
    weight: 400,
    isFeatured: true,
    isActive: true,
    image: 'https://placehold.co/600x600/1a472a/ffffff?text=Jaket+Sports',
  },
  {
    categorySlug: 'pakaian-olahraga-pria',
    name: 'Jogger ONETONE',
    description: 'Celana jogger pria ONETONE bahan fleece lembut, cocok untuk gym, jogging, dan santai di rumah.',
    price: '115000',
    stock: 45,
    weight: 300,
    isFeatured: false,
    isActive: true,
    image: 'https://placehold.co/600x600/2d6a4f/ffffff?text=Jogger',
  },
  // --- Pakaian Casual Wanita ---
  {
    categorySlug: 'pakaian-casual-wanita',
    name: 'Batwing ONETONE',
    description: 'Atasan batwing wanita ONETONE — desain loose dan feminine, cocok untuk tampilan casual sehari-hari.',
    price: '95000',
    stock: 40,
    weight: 200,
    isFeatured: false,
    isActive: true,
    image: 'https://placehold.co/600x600/6d2b7e/ffffff?text=Batwing',
  },
  {
    categorySlug: 'pakaian-casual-wanita',
    name: 'Kulot ONETONE',
    description: 'Celana kulot wanita ONETONE, model loose culottes yang nyaman dan stylish untuk aktivitas sehari-hari.',
    price: '105000',
    stock: 35,
    weight: 250,
    isFeatured: false,
    isActive: true,
    image: 'https://placehold.co/600x600/9b2226/ffffff?text=Kulot',
  },
  // --- Pakaian Casual Pria ---
  {
    categorySlug: 'pakaian-casual-pria',
    name: 'Hoodie Casual ONETONE',
    description: 'Hoodie casual pria ONETONE bahan cotton fleece premium, desain minimalis dan timeless untuk gaya sehari-hari.',
    price: '145000',
    stock: 30,
    weight: 350,
    isFeatured: true,
    isActive: true,
    image: 'https://placehold.co/600x600/370617/ffffff?text=Hoodie',
  },
  // --- Aksesoris ---
  {
    categorySlug: 'aksesoris',
    name: 'Hijab Sports ONETONE',
    description: 'Hijab sports ONETONE berbahan jersey stretch, tidak mudah geser saat berolahraga, tersedia berbagai warna.',
    price: '55000',
    stock: 80,
    weight: 80,
    isFeatured: false,
    isActive: true,
    image: 'https://placehold.co/600x600/7b2d8b/ffffff?text=Hijab+Sports',
  },
  // --- Bundle & Set ---
  {
    categorySlug: 'bundle-set',
    name: 'Bundle Set Gym Wanita ONETONE',
    description: 'Paket hemat set olahraga wanita ONETONE: 1 legging + 1 rompi crop. Hemat lebih banyak dibanding beli satuan.',
    price: '159000',
    stock: 20,
    weight: 400,
    isFeatured: true,
    isActive: true,
    image: 'https://placehold.co/600x600/003049/ffffff?text=Bundle+Set+Gym',
  },
];

export async function seedProducts(): Promise<{ success: boolean; inserted: number; skipped: number; error?: string }> {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return { success: false, inserted: 0, skipped: 0, error: 'Unauthorized' };
  }

  // Load all categories to map slug -> id
  const allCategories = await db.select().from(categories);
  const categoryMap = new Map(allCategories.map((c) => [c.slug, c.id]));

  if (categoryMap.size === 0) {
    return {
      success: false,
      inserted: 0,
      skipped: 0,
      error: 'Seed kategori terlebih dahulu sebelum seed produk.',
    };
  }

  let inserted = 0;
  let skipped = 0;

  for (const prod of ONETONE_PRODUCTS) {
    try {
      const slug = slugify(prod.name);
      const categoryId = categoryMap.get(prod.categorySlug) ?? null;

      const existing = await db
        .select({ id: products.id })
        .from(products)
        .where(sql`${products.slug} = ${slug}`)
        .limit(1);

      if (existing.length > 0) {
        skipped++;
      } else {
        await db.insert(products).values({
          categoryId,
          name: prod.name,
          slug,
          description: prod.description,
          price: prod.price,
          stock: prod.stock,
          weight: prod.weight,
          image: prod.image,
          isFeatured: prod.isFeatured,
          isActive: prod.isActive,
        });
        inserted++;
      }
    } catch {
      skipped++;
    }
  }

  revalidatePath('/dashboard/products');
  revalidatePath('/products');
  revalidatePath('/');

  return { success: true, inserted, skipped };
}
