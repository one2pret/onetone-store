// app/actions/products.ts
'use server';

import { db } from '@/lib/db';
import { products, categories, productImages } from '@/lib/db/schema';
import { eq, desc, and, like, asc, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { setOnlineInventoryStock } from '@/lib/inventory-stock';
import { slugify } from '@/lib/utils';
import { getAllCategories } from '@/app/actions/categories';
import { auth } from '@/lib/auth';
import { assertBarcodeAvailable, getProductBarcodeRows, setPrimaryBarcode } from '@/lib/product-barcodes';

async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === 'admin';
}

const optionalNumber = z.preprocess(
  (value) => value === '' || value === null || value === undefined ? null : value,
  z.coerce.number().positive('Harga promo harus lebih dari 0').nullable(),
);

const optionalDate = z.preprocess(
  (value) => value === '' || value === null || value === undefined ? null : value,
  z.coerce.date().nullable(),
);

const productSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi'),
  posName: z.string().trim().max(60, 'Nama POS maksimal 60 karakter').optional(),
  categoryId: z.coerce.number().optional().nullable(),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Harga tidak boleh negatif'),
  salePrice: optionalNumber,
  saleStartsAt: optionalDate,
  saleEndsAt: optionalDate,
  stock: z.coerce.number().min(0, 'Stock tidak boleh negatif'),
  weight: z.coerce.number().min(0, 'Berat tidak boleh negatif').default(0),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  channel: z.enum(['all', 'store_only', 'marketplace_only']).default('all'),
}).superRefine((data, ctx) => {
  if (data.salePrice !== null && data.salePrice >= data.price) {
    ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'Harga promo harus lebih rendah dari harga normal' });
  }
  if (data.saleStartsAt && data.saleEndsAt && data.saleEndsAt <= data.saleStartsAt) {
    ctx.addIssue({ code: 'custom', path: ['saleEndsAt'], message: 'Waktu selesai harus setelah waktu mulai' });
  }
});

function productFormValues(formData: FormData) {
  return {
    name: formData.get('name'),
    posName: formData.get('posName') || '',
    categoryId: formData.get('categoryId') || null,
    description: formData.get('description'),
    price: formData.get('price'),
    salePrice: formData.get('salePrice'),
    saleStartsAt: formData.get('saleStartsAt'),
    saleEndsAt: formData.get('saleEndsAt'),
    stock: formData.get('stock'),
    weight: formData.get('weight') || 0,
    isActive: formData.get('isActive') === 'on',
    isFeatured: formData.get('isFeatured') === 'on',
    channel: formData.get('channel') || 'all',
  };
}

async function queryProductsWithCategory(whereConditions: any[], options?: { limit?: number }) {
  let query = db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...whereConditions))
    .orderBy(desc(products.createdAt))
    .$dynamic();

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const rows = await query;
  return rows.map(row => ({ ...row.products, category: row.categories }));
}

export async function getProducts() {
  const rows = await db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(desc(products.createdAt));
  return rows.map(row => ({ ...row.products, category: row.categories }));
}

export async function getActiveProducts(options?: {
  categorySlug?: string;
  search?: string;
  limit?: number;
  featured?: boolean;
  forStore?: boolean;
}) {
  const channelFilter = options?.forStore
    ? or(eq(products.channel, 'all'), eq(products.channel, 'store_only'))!
    : or(eq(products.channel, 'all'), eq(products.channel, 'marketplace_only'))!;

  let whereConditions: any[] = [eq(products.isActive, true), channelFilter];
  if (options?.featured) whereConditions.push(eq(products.isFeatured, true));
  if (options?.search) whereConditions.push(like(products.name, `%${options.search}%`));

  const results = await queryProductsWithCategory(whereConditions, { limit: options?.limit });
  if (options?.categorySlug) {
    return results.filter(p => p.category?.slug === options.categorySlug);
  }
  return results;
}

export async function getFeaturedProducts(limit = 8, forStore = false) {
  return getActiveProducts({ featured: true, limit, forStore });
}

export async function getBestSellerProducts(limit = 4, forStore = false) {
  const channelFilter = forStore
    ? or(eq(products.channel, 'all'), eq(products.channel, 'store_only'))!
    : or(eq(products.channel, 'all'), eq(products.channel, 'marketplace_only'))!;
  const whereConditions: any[] = [
    eq(products.isActive, true),
    eq(products.isBestSeller, true),
    channelFilter,
  ];
  return queryProductsWithCategory(whereConditions, { limit });
}

export async function getProductBySlug(slug: string) {
  const rows = await db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);

  if (rows.length === 0) return null;
  return { ...rows[0].products, category: rows[0].categories };
}

export async function getProduct(id: number) {
  const rows = await db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  return { ...rows[0].products, category: rows[0].categories };
}

export async function getCategories() {
  return await db.select().from(categories)
    .where(eq(categories.isVisible, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryBySlug(slug: string) {
  const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/**
 * Create product — returns { success, productId } instead of redirecting.
 * The caller (ProductForm) handles redirect after upsertProductVariants.
 */
export async function createProduct(prevState: any, formData: FormData) {
  if (!(await isAdmin())) {
    return {
      success: false,
      errors: { _form: ['Unauthorized'] },
      productId: undefined,
    };
  }

  const validated = productSchema.safeParse(productFormValues(formData));

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors, productId: undefined };
  }

  const image = (formData.get('image') as string) || '';
  const images = (formData.get('images') as string) || '[]';
  const slug = slugify(validated.data.name);

  try {
    await assertBarcodeAvailable(String(formData.get('barcode') ?? ''));
    const inserted = await db
      .insert(products)
      .values({
        ...validated.data,
        posName: validated.data.posName || null,
        slug,
        image,
        images,
        price: String(validated.data.price),
        salePrice: validated.data.salePrice === null ? null : String(validated.data.salePrice),
      })
      .$returningId(); // Use $returningId without specific selection for simplicity

    const productId = inserted[0]?.id; // Access id from the first element of the returned array
    if (productId) await setOnlineInventoryStock(productId, null, validated.data.stock);
    if (productId) await setPrimaryBarcode(productId, null, String(formData.get('barcode') ?? ''));
    revalidatePath('/dashboard/products');
    revalidatePath('/products');
    // FIX: return productId so caller can save variants, then redirect
    return { success: true, productId };
  } catch (error) {
    return {
      success: false,
      errors: { _form: [error instanceof Error ? error.message : 'Gagal membuat produk. Pastikan nama produk belum digunakan.'] },
      productId: undefined,
    };
  }
}

/**
 * Update product — returns { success } instead of redirecting.
 * The caller (ProductForm) handles redirect after upsertProductVariants.
 */
export async function updateProduct(id: number, prevState: any, formData: FormData) {
  if (!(await isAdmin())) {
    return {
      success: false,
      errors: { _form: ['Unauthorized'] },
      productId: id,
    };
  }

  const validated = productSchema.safeParse(productFormValues(formData));

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors, productId: id };
  }

  const formImage = (formData.get('image') as string) || '';
  const images = (formData.get('images') as string) || '[]';
  const slug = slugify(validated.data.name);

  try {
    await assertBarcodeAvailable(String(formData.get('barcode') ?? ''), { productId: id, variantId: null });
    // Cek apakah produk sudah punya gambar di R2 (product_images table)
    // Kalau ada, jangan overwrite products.image — biarkan product-images.ts yang manage
    const r2Images = await db.select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, id))
      .limit(1);

    const image = r2Images.length > 0 ? undefined : formImage;

    const updateData: Record<string, any> = {
      ...validated.data,
      posName: validated.data.posName || null,
      slug,
      images,
      price: String(validated.data.price),
      salePrice: validated.data.salePrice === null ? null : String(validated.data.salePrice),
    };
    if (image !== undefined) updateData.image = image;

    await db.update(products).set(updateData).where(eq(products.id, id));
    await setOnlineInventoryStock(id, null, validated.data.stock);
    await setPrimaryBarcode(id, null, String(formData.get('barcode') ?? ''));
  } catch (error) {
    return { success: false, errors: { _form: [error instanceof Error ? error.message : 'Gagal update produk.'] }, productId: id };
  }

  revalidatePath('/dashboard/products');
  revalidatePath('/products');
  // FIX: return success so caller can save variants, then redirect
  return { success: true, productId: id };
}

/**
 * Buat row produk draft minimal saat halaman "Tambah Produk" dibuka —
 * supaya productId ada dari awal, sehingga uploader gambar & Google Drive
 * import bisa langsung dipakai tanpa nunggu submit pertama.
 * Slug pakai timestamp biar unik walau nama masih kosong/default.
 */
export async function createDraftProduct(): Promise<number | null> {
  if (!(await isAdmin())) return null;

  const slug = `draft-${Date.now()}`;
  const inserted = await db
    .insert(products)
    .values({
      name: 'Produk Baru',
      slug,
      price: '0',
      stock: 0,
      weight: 0,
      image: '',
      images: '[]',
      isActive: false,
      isFeatured: false,
      channel: 'all',
    })
    .$returningId();

  if (inserted[0]?.id) await setOnlineInventoryStock(inserted[0].id, null, 0);

  return inserted[0]?.id as number;
}

export async function getProductBarcodes(productId: number) {
  if (!(await isAdmin())) return [];
  return getProductBarcodeRows(productId);
}

export async function deleteProduct(id: number) {
  if (!(await isAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await db.delete(products).where(eq(products.id, id));
    revalidatePath('/dashboard/products');
    revalidatePath('/products');
    return { success: true };
  } catch {
    return { success: false, error: 'Gagal hapus produk' };
  }
}

// ============ CSV IMPORT ============

const CSV_TEMPLATE_HEADERS = ['nama', 'kategori', 'harga', 'stok', 'berat', 'deskripsi'] as const;

// Parser CSV minim (RFC4180-ish): handle quoted field berisi koma/newline/kutip-ganda.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // skip, handled by \n
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export type ImportRowError = { row: number; name: string; reason: string };
export type ImportResult = {
  success: boolean;
  imported: number;
  errors: ImportRowError[];
  formError?: string;
};

/**
 * Import produk massal dari CSV. Kolom wajib: nama, harga.
 * Kolom opsional: kategori (dicocokkan by nama, case-insensitive), stok, berat, deskripsi.
 * Semua produk masuk sebagai draft (isActive: false) — admin lengkapi gambar & aktifkan manual.
 */
export async function importProductsFromCsv(prevState: any, formData: FormData): Promise<ImportResult> {
  if (!(await isAdmin())) {
    return { success: false, imported: 0, errors: [], formError: 'Unauthorized' };
  }

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { success: false, imported: 0, errors: [], formError: 'Pilih file CSV terlebih dahulu.' };
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { success: false, imported: 0, errors: [], formError: 'File CSV kosong atau tidak ada baris data.' };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = (name: string) => header.indexOf(name);
  const iName = colIndex('nama');
  const iKategori = colIndex('kategori');
  const iHarga = colIndex('harga');
  const iStok = colIndex('stok');
  const iBerat = colIndex('berat');
  const iDeskripsi = colIndex('deskripsi');

  if (iName === -1 || iHarga === -1) {
    return {
      success: false,
      imported: 0,
      errors: [],
      formError: `Header CSV tidak valid. Wajib ada kolom: ${CSV_TEMPLATE_HEADERS.join(', ')}.`,
    };
  }

  const allCategories = await getAllCategories();
  const categoryByName = new Map(allCategories.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const errors: ImportRowError[] = [];
  let imported = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rowNum = r + 1; // +1 karena baris 1 adalah header, jadi ini nomor baris di file asli
    const name = (cells[iName] ?? '').trim();
    const kategoriRaw = iKategori !== -1 ? (cells[iKategori] ?? '').trim() : '';
    const hargaRaw = (cells[iHarga] ?? '').trim();
    const stokRaw = iStok !== -1 ? (cells[iStok] ?? '').trim() : '';
    const beratRaw = iBerat !== -1 ? (cells[iBerat] ?? '').trim() : '';
    const deskripsi = iDeskripsi !== -1 ? (cells[iDeskripsi] ?? '').trim() : '';

    if (!name) {
      errors.push({ row: rowNum, name: '(kosong)', reason: 'Nama produk wajib diisi' });
      continue;
    }

    const price = Number(hargaRaw.replace(/[^0-9.]/g, ''));
    if (!hargaRaw || Number.isNaN(price) || price < 0) {
      errors.push({ row: rowNum, name, reason: `Harga tidak valid: "${hargaRaw}"` });
      continue;
    }

    let categoryId: number | null = null;
    if (kategoriRaw) {
      const match = categoryByName.get(kategoriRaw.toLowerCase());
      if (!match) {
        errors.push({ row: rowNum, name, reason: `Kategori tidak ditemukan: "${kategoriRaw}"` });
        continue;
      }
      categoryId = match;
    }

    const stock = stokRaw ? Number(stokRaw) : 0;
    if (stokRaw && (Number.isNaN(stock) || stock < 0)) {
      errors.push({ row: rowNum, name, reason: `Stok tidak valid: "${stokRaw}"` });
      continue;
    }

    const weight = beratRaw ? Number(beratRaw) : 0;
    if (beratRaw && (Number.isNaN(weight) || weight < 0)) {
      errors.push({ row: rowNum, name, reason: `Berat tidak valid: "${beratRaw}"` });
      continue;
    }

    const slug = slugify(name);

    try {
      const inserted = await db.insert(products).values({
        name,
        slug,
        categoryId,
        description: deskripsi || null,
        price: String(price),
        stock: stock || 0,
        weight: weight || 0,
        image: '',
        images: '[]',
        isActive: false,
        isFeatured: false,
        channel: 'all',
      }).$returningId();
      if (inserted[0]?.id) await setOnlineInventoryStock(inserted[0].id, null, stock || 0);
      imported++;
    } catch {
      errors.push({ row: rowNum, name, reason: 'Gagal simpan — kemungkinan nama produk sudah dipakai' });
    }
  }

  if (imported > 0) {
    revalidatePath('/dashboard/products');
    revalidatePath('/products');
  }

  return { success: imported > 0, imported, errors };
}
