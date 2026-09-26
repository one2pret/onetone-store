// app/api/banners/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { banners } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { isAllowedExternalBannerUrl, toPublicBanner } from '@/lib/banner-images';

export async function GET() {
  try {
    const activeBanners = await db.select()
      .from(banners)
      .where(eq(banners.isActive, true))
      .orderBy(asc(banners.sortOrder));

    const data = activeBanners
      .filter(banner => banner.imageObjectKey || isAllowedExternalBannerUrl(banner.image))
      .map(toPublicBanner);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data banner' },
      { status: 500 },
    );
  }
}
