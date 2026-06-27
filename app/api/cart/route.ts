// app/api/cart/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cartItems, products } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getApiUser } from '@/lib/api-auth';

// GET /api/cart
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db.select()
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, user.id));

    const items = rows.map(row => ({
      ...row.cart_items,
      product: row.products,
    }));

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil data keranjang' },
      { status: 500 },
    );
  }
}

// POST /api/cart
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { productId, quantity = 1 } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'productId wajib diisi' },
        { status: 400 },
      );
    }

    // Check product exists & active
    const productRows = await db.select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (productRows.length === 0 || !productRows[0].isActive) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan' },
        { status: 404 },
      );
    }

    const product = productRows[0];
    if (product.stock !== null && product.stock < quantity) {
      return NextResponse.json(
        { success: false, error: 'Stok tidak mencukupi' },
        { status: 400 },
      );
    }

    // Check existing cart item
    const existing = await db.select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, user.id), eq(cartItems.productId, productId)))
      .limit(1);

    if (existing.length > 0) {
      const newQty = (existing[0].quantity || 0) + quantity;

      // Check stock for new total
      if (product.stock !== null && product.stock < newQty) {
        return NextResponse.json(
          { success: false, error: `Stok tersisa ${product.stock}` },
          { status: 400 },
        );
      }

      await db.update(cartItems)
        .set({ quantity: newQty })
        .where(eq(cartItems.id, existing[0].id));

      return NextResponse.json({
        success: true,
        data: { id: existing[0].id, quantity: newQty },
      });
    }

    const [result] = await db.insert(cartItems).values({
      userId: user.id,
      productId,
      quantity,
    });

    return NextResponse.json(
      {
        success: true,
        data: { id: Number(result.insertId), quantity },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal menambahkan ke keranjang' },
      { status: 500 },
    );
  }
}
