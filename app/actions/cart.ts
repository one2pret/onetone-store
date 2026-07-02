// app/actions/cart.ts
'use server';

import { db } from '@/lib/db';
import { cartItems, products, productVariants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ---- helpers ----
function variantPrice(basePrice: string | number, modifier: string | null): number {
  return Number(basePrice) + Number(modifier ?? 0);
}

// Get user's cart — includes variant join
export async function getCart() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = Number(session.user.id);

  const rows = await db
    .select()
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(cartItems.userId, userId));

  return rows.map((row) => ({
    ...row.cart_items,
    product: row.products!,
    variant: row.product_variants ?? null,
  }));
}

// Get cart count
export async function getCartCount() {
  const cart = await getCart();
  return cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

// Get cart total (respects priceModifier)
export async function getCartTotal() {
  const cart = await getCart();
  return cart.reduce((sum, item) => {
    const price = variantPrice(item.product.price, item.variant?.priceModifier ?? null);
    return sum + price * (item.quantity || 0);
  }, 0);
}

// Add item to cart — accepts optional variantId
export async function addToCart(
  productId: number,
  quantity = 1,
  variantId?: number
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const userId = Number(session.user.id);

  try {
    const productRows = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    const product = productRows[0];
    if (!product) return { success: false, error: 'Produk tidak ditemukan' };

    // Validate variant stock if variantId provided
    if (variantId) {
      const variantRows = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);
      const variant = variantRows[0];
      if (!variant) return { success: false, error: 'Varian tidak ditemukan' };
      if (variant.stock < quantity)
        return { success: false, error: 'Stok varian tidak mencukupi' };
    } else {
      // Non-variant product: check product.stock
      if (product.stock !== null && product.stock < quantity)
        return { success: false, error: 'Stok tidak mencukupi' };
    }

    // Check if exact same product+variant already in cart
    const conditions = variantId
      ? and(
          eq(cartItems.userId, userId),
          eq(cartItems.productId, productId),
          eq(cartItems.variantId, variantId)
        )
      : and(
          eq(cartItems.userId, userId),
          eq(cartItems.productId, productId)
        );

    const existingRows = await db
      .select()
      .from(cartItems)
      .where(conditions)
      .limit(1);
    const existing = existingRows[0];

    if (existing) {
      const newQty = (existing.quantity || 0) + quantity;
      // Re-check stock
      if (variantId) {
        const vRows = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, variantId))
          .limit(1);
        if (vRows[0] && vRows[0].stock < newQty)
          return { success: false, error: 'Stok varian tidak mencukupi' };
      }
      await db
        .update(cartItems)
        .set({ quantity: newQty })
        .where(eq(cartItems.id, existing.id));
    } else {
      await db.insert(cartItems).values({
        userId,
        productId,
        variantId: variantId ?? null,
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
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    if (quantity <= 0) {
      await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
    } else {
      await db
        .update(cartItems)
        .set({ quantity })
        .where(eq(cartItems.id, cartItemId));
    }
    revalidatePath('/cart');
    return { success: true };
  } catch {
    return { success: false, error: 'Gagal update keranjang' };
  }
}

// Remove item from cart
export async function removeFromCart(cartItemId: number) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  try {
    await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
    revalidatePath('/cart');
    return { success: true };
  } catch {
    return { success: false, error: 'Gagal hapus dari keranjang' };
  }
}

// Clear cart
export async function clearCart() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  const userId = Number(session.user.id);
  try {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
    revalidatePath('/cart');
    return { success: true };
  } catch {
    return { success: false, error: 'Gagal mengosongkan keranjang' };
  }
}
