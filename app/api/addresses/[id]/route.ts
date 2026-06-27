// app/api/addresses/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addresses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';
import { z } from 'zod';

const addressSchema = z.object({
  recipientName: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  address: z.string().min(10).optional(),
  detail: z.string().optional().nullable(),
  province: z.string().min(1).optional(),
  provinceId: z.string().optional().nullable(),
  city: z.string().min(1).optional(),
  cityId: z.string().optional().nullable(),
  district: z.string().min(1).optional(),
  districtId: z.string().optional().nullable(),
  postalCode: z.string().min(1).optional(),
  latitude: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
});

async function getOwnedAddress(addressId: number, userId: number) {
  const rows = await db.select().from(addresses)
    .where(eq(addresses.id, addressId))
    .limit(1);
  if (rows.length === 0 || rows[0].userId !== userId) return null;
  return rows[0];
}

// GET /api/addresses/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const address = await getOwnedAddress(Number(id), user.id);
  if (!address) {
    return NextResponse.json({ success: false, error: 'Alamat tidak ditemukan' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: address });
}

// PUT /api/addresses/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getOwnedAddress(Number(id), user.id);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Alamat tidak ditemukan' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const validated = addressSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validasi gagal', errors: validated.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (validated.data.isDefault) {
      await db.update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, user.id));
    }

    await db.update(addresses)
      .set(validated.data)
      .where(eq(addresses.id, Number(id)));

    const updated = await db.select().from(addresses)
      .where(eq(addresses.id, Number(id)))
      .limit(1);

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal update alamat' },
      { status: 500 },
    );
  }
}

// DELETE /api/addresses/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getOwnedAddress(Number(id), user.id);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Alamat tidak ditemukan' }, { status: 404 });
  }

  try {
    await db.delete(addresses).where(eq(addresses.id, Number(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus alamat' },
      { status: 500 },
    );
  }
}
