// app/api/cart/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cartItems } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';

// Verify cart item belongs to user
async function getOwnedCartItem(cartItemId: number, userId: number) {
  const rows = await db.select()
    .from(cartItems)
    .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

// PUT /api/cart/[id] — update quantity
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const cartItemId = Number(id);
    const { quantity } = await request.json();

    const item = await getOwnedCartItem(cartItemId, user.id);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan' }, { status: 404 });
    }

    if (quantity <= 0) {
      await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
      return NextResponse.json({ success: true, message: 'Item dihapus' });
    }

    await db.update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.id, cartItemId));

    return NextResponse.json({ success: true, data: { id: cartItemId, quantity } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal update keranjang' },
      { status: 500 },
    );
  }
}

// DELETE /api/cart/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const cartItemId = Number(id);

    const item = await getOwnedCartItem(cartItemId, user.id);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan' }, { status: 404 });
    }

    await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal hapus item' },
      { status: 500 },
    );
  }
}
