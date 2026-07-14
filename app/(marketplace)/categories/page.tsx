// app/(marketplace)/categories/page.tsx
import Link from 'next/link';
import { getCategories } from '@/app/actions/products';
import { db } from '@/lib/db';
import { products, categories } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { ChevronRight } from 'lucide-react';

export default async function CategoriesPage() {
  const cats = await getCategories();

  const counts = await Promise.all(
    cats.map((cat) =>
      db
        .select({ count: count() })
        .from(products)
        .where(and(eq(products.categoryId, cat.id), eq(products.isActive, true)))
        .then((r) => r[0]?.count ?? 0)
    )
  );

  const catsWithCount = cats.map((cat, i) => ({ ...cat, productCount: counts[i] }));

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Semua Kategori</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {cats.length} kategori tersedia
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {catsWithCount.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-surface transition-all group"
            >
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition">
                  {cat.name}
                </p>
                {cat.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {cat.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {cat.productCount} produk
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition shrink-0 ml-3" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
