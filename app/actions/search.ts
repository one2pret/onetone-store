// app/actions/search.ts
'use server';

import { db } from '@/lib/db';
import { products, categories } from '@/lib/db/schema';
import { like, eq, or } from 'drizzle-orm';

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

  const [productRows, categoryRows] = await Promise.all([
    db.select({ id: products.id, name: products.name, slug: products.slug })
      .from(products)
      .where(like(products.name, q))
      .limit(5),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(like(categories.name, q))
      .limit(3),
  ]);

  const results: SearchResultItem[] = [
    ...productRows.map(p => ({
      type: 'product' as const,
      id: p.id,
      label: p.name,
      sublabel: p.slug,
      href: `/dashboard/products/${p.id}/edit`,
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
