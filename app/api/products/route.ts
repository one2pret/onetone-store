// app/api/products/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, categories } from '@/lib/db/schema';
import { eq, like, sql, and } from 'drizzle-orm';

// GET /api/products?category=slug&featured=true&search=keyword&page=1&limit=20
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const search = searchParams.get('search');
    const rawPage = Number(searchParams.get('page') || 1);
    const rawLimit = Number(searchParams.get('limit') || 20);
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isSafeInteger(rawLimit) && rawLimit > 0 ? Math.min(100, rawLimit) : 20;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [eq(products.isActive, true)];

    if (featured === 'true') {
      conditions.push(eq(products.isFeatured, true));
    }

    if (search) {
      conditions.push(like(products.name, `%${search}%`));
    }
    if (category) {
      conditions.push(eq(categories.slug, category));
    }

    // Base query with category join
    const rows = await db.select({
      product: products,
      category: categories,
    })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    const allProducts = rows.map(row => ({
      ...row.product,
      category: row.category,
    }));

    // Get total count for pagination
    const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions));

    const total = Number(countResult.count);

    return NextResponse.json({
      success: true,
      data: allProducts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 },
    );
  }
}
