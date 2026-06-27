// app/api/addresses/[id]/default/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addresses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';

// PUT /api/addresses/[id]/default — set as default address
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const addressId = Number(id);

  // Verify ownership
  const rows = await db.select().from(addresses)
    .where(eq(addresses.id, addressId))
    .limit(1);

  if (rows.length === 0 || rows[0].userId !== user.id) {
    return NextResponse.json({ success: false, error: 'Alamat tidak ditemukan' }, { status: 404 });
  }

  try {
    // Unset all defaults
    await db.update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, user.id));

    // Set this as default
    await db.update(addresses)
      .set({ isDefault: true })
      .where(eq(addresses.id, addressId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal set alamat utama' },
      { status: 500 },
    );
  }
}
