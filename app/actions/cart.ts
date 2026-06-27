// app/actions/cart.ts
'use server';

import { db } from '@/lib/db';
import { cartItems, products } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// Get user's cart
export async function getCart() {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const userId = Number(session.user.id);

  const rows = await db.select()
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, userId));

  return rows.map(row => ({
    ...row.cart_items,
    product: row.products!,
  }));
}

// Get cart count
export async function getCartCount() {
  const cart = await getCart();
  return cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

// Get cart total
export async function getCartTotal() {
  const cart = await getCart();
  return cart.reduce((sum, item) => {
    return sum + (Number(item.product.price) * (item.quantity || 0));
  }, 0);
}

// Add item to cart
export async function addToCart(productId: number, quantity = 1) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const userId = Number(session.user.id);

  try {
    // Check if product exists and has stock
    const productRows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    const product = productRows[0];

    if (!product) {
      return { success: false, error: 'Produk tidak ditemukan' };
    }

    if (product.stock !== null && product.stock < quantity) {
      return { success: false, error: 'Stok tidak mencukupi' };
    }

    // Check if item already in cart
    const existingRows = await db.select().from(cartItems).where(
      and(
        eq(cartItems.userId, userId),
        eq(cartItems.productId, productId)
      )
    ).limit(1);
    const existing = existingRows[0];

    if (existing) {
      // Update quantity
      const newQuantity = (existing.quantity || 0) + quantity;

      if (product.stock !== null && product.stock < newQuantity) {
        return { success: false, error: 'Stok tidak mencukupi' };
      }

      await db.update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.id, existing.id));
    } else {
      // Add new item
      await db.insert(cartItems).values({
        userId,
        productId,
        quantity,
      });
    }

    revalidatePath('/cart');
    return { success: true };
  } catch (error) {
    console.error('Add to cart error:', error);
    return { success: false, error: 'Gagal menambahkan ke keranjang' };
  }
}

// Update cart item quantity
export async function updateCartItem(cartItemId: number, quantity: number) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    if (quantity <= 0) {
      await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
    } else {
      await db.update(cartItems)
        .set({ quantity })
        .where(eq(cartItems.id, cartItemId));
    }

    revalidatePath('/cart');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal update keranjang' };
  }
}

// Remove item from cart
export async function removeFromCart(cartItemId: number) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
    revalidatePath('/cart');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal hapus dari keranjang' };
  }
}

// Clear cart
export async function clearCart() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const userId = Number(session.user.id);

  try {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
    revalidatePath('/cart');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal mengosongkan keranjang' };
  }
}
