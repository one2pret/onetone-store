// app/actions/search.ts
'use server';

import { db } from '@/lib/db';
import { products, categories, productBarcodes, productVariants } from '@/lib/db/schema';
import { like, eq } from 'drizzle-orm';

export type SearchResultItem = {
  type: 'product' | 'category';
  id: number;
  label: string;
  sublabel?: string;
  href: string;
};

export async function searchAdmin(query: string): Promise<SearchResultItem[]> {
  if (!query || query.trim().length < 2) return [];

  const q = `%${query.trim()}%`;

  const [productRows, categoryRows, barcodeRows] = await Promise.all([
    db.select({ id: products.id, name: products.name, slug: products.slug })
      .from(products)
      .where(like(products.name, q))
      .limit(5),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(like(categories.name, q))
      .limit(3),
    db.select({ id: products.id, name: products.name, slug: products.slug, code: productBarcodes.code, size: productVariants.size, color: productVariants.color })
      .from(productBarcodes)
      .innerJoin(products, eq(productBarcodes.productId, products.id))
      .leftJoin(productVariants, eq(productBarcodes.variantId, productVariants.id))
      .where(like(productBarcodes.code, q))
      .limit(5),
  ]);

  const seenProducts = new Set(productRows.map(product => product.id));
  const results: SearchResultItem[] = [
    ...productRows.map(p => ({
      type: 'product' as const,
      id: p.id,
      label: p.name,
      sublabel: p.slug,
      href: `/dashboard/products/${p.id}/edit`,
    })),
    ...barcodeRows.filter(row => !seenProducts.has(row.id)).map(row => ({
      type: 'product' as const,
      id: row.id,
      label: row.name,
      sublabel: `${row.code}${row.size || row.color ? ` · ${row.size ?? '-'} / ${row.color ?? '-'}` : ''}`,
      href: `/dashboard/products/${row.id}/edit`,
    })),
    ...categoryRows.map(c => ({
      type: 'category' as const,
      id: c.id,
      label: c.name,
      sublabel: c.slug,
      href: `/dashboard/categories/${c.id}/edit`,
    })),
  ];

  return results;
}

export async function findAdminBarcode(rawCode: string): Promise<SearchResultItem | null> {
  const code = rawCode.trim();
  if (!code || code.length > 100) return null;
  const rows = await db.select({ id: products.id, name: products.name, code: productBarcodes.code, size: productVariants.size, color: productVariants.color })
    .from(productBarcodes)
    .innerJoin(products, eq(productBarcodes.productId, products.id))
    .leftJoin(productVariants, eq(productBarcodes.variantId, productVariants.id))
    .where(eq(productBarcodes.code, code))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { type: 'product', id: row.id, label: row.name, sublabel: `${row.code}${row.size || row.color ? ` · ${row.size ?? '-'} / ${row.color ?? '-'}` : ''}`, href: `/dashboard/products/${row.id}/edit` };
}
