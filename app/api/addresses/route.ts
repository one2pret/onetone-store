// app/api/addresses/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addresses } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';
import { z } from 'zod';

const addressSchema = z.object({
  recipientName: z.string().min(1, 'Nama penerima wajib diisi'),
  phone: z.string().min(10, 'Nomor HP minimal 10 digit'),
  address: z.string().min(10, 'Alamat minimal 10 karakter'),
  detail: z.string().optional().nullable(),
  province: z.string().min(1, 'Provinsi wajib diisi'),
  provinceId: z.string().optional().nullable(),
  city: z.string().min(1, 'Kota wajib diisi'),
  cityId: z.string().optional().nullable(),
  district: z.string().min(1, 'Kecamatan wajib diisi'),
  districtId: z.string().optional().nullable(),
  postalCode: z.string().min(1, 'Kode pos wajib diisi'),
  latitude: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
});

// GET /api/addresses
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db.select().from(addresses)
      .where(eq(addresses.userId, user.id))
      .orderBy(desc(addresses.isDefault));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data alamat' },
      { status: 500 },
    );
  }
}

// POST /api/addresses
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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

    // If setting as default, unset others first
    if (validated.data.isDefault) {
      await db.update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, user.id));
    }

    const [result] = await db.insert(addresses).values({
      ...validated.data,
      userId: user.id,
    });

    // Fetch the created address
    const created = await db.select().from(addresses)
      .where(eq(addresses.id, Number(result.insertId)))
      .limit(1);

    return NextResponse.json(
      { success: true, data: created[0] },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal menambahkan alamat' },
      { status: 500 },
    );
  }
}
