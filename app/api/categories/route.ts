// app/api/categories/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  try {
    const allCategories = await db.select()
      .from(categories)
      .orderBy(asc(categories.name));

    return NextResponse.json({
      success: true,
      data: allCategories,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data kategori' },
      { status: 500 }
    );
  }
}
