// app/actions/cart.ts
'use server';

import { db } from '@/lib/db';
import { cartItems, products, productVariants } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { calculateCartSubtotal } from '@/lib/cart-pricing';

type CartWriteMode = 'increment' | 'ensure';

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
  return calculateCartSubtotal(cart);
}

async function writeCartItem(
  productId: number,
  quantity: number,
  variantId: number | undefined,
  mode: CartWriteMode,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const userId = Number(session.user.id);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, error: 'Jumlah produk tidak valid' };
  }

  try {
    const productRows = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    const product = productRows[0];
    if (!product || !product.isActive) {
      return { success: false, error: 'Produk tidak ditemukan atau tidak aktif' };
    }

    // Validate variant stock if variantId provided
    if (variantId) {
      const variantRows = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);
      const variant = variantRows[0];
      if (!variant) return { success: false, error: 'Varian tidak ditemukan' };

      if (variant.productId !== productId) {
        return { success: false, error: 'Varian tidak sesuai dengan produk' };
      }

      // Check if variant is active
      if (!variant.isActive) {
        return { success: false, error: 'Varian ini tidak aktif dan tidak dapat ditambahkan ke keranjang' };
      }

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
          eq(cartItems.productId, productId),
          isNull(cartItems.variantId),
        );

    const existingRows = await db
      .select()
      .from(cartItems)
      .where(conditions)
      .limit(1);
    const existing = existingRows[0];

    if (existing) {
      if (mode === 'ensure') {
        return { success: true, quantity: existing.quantity ?? 1, alreadyInCart: true };
      }

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
      } else if (product.stock !== null && product.stock < newQty) {
        return { success: false, error: 'Stok tidak mencukupi' };
      }
      await db
        .update(cartItems)
        .set({ quantity: newQty })
        .where(and(eq(cartItems.id, existing.id), eq(cartItems.userId, userId)));

      revalidatePath('/cart');
      revalidatePath('/checkout');
      return { success: true, quantity: newQty, alreadyInCart: true };
    } else {
      await db.insert(cartItems).values({
        userId,
        productId,
        variantId: variantId ?? null,
        quantity,
      });
    }

    revalidatePath('/cart');
    revalidatePath('/checkout');
    return { success: true, quantity, alreadyInCart: false };
  } catch (error) {
    console.error('Add to cart error:', error);
    return { success: false, error: 'Gagal menambahkan ke keranjang' };
  }
}

// Add to cart intentionally increments an existing product+variant quantity.
export async function addToCart(productId: number, quantity = 1, variantId?: number) {
  return writeCartItem(productId, quantity, variantId, 'increment');
}

// Buy-now behavior is idempotent: insert when absent, keep quantity when present.
export async function ensureCartItem(productId: number, quantity = 1, variantId?: number) {
  return writeCartItem(productId, quantity, variantId, 'ensure');
}

// Update cart item quantity
export async function updateCartItem(cartItemId: number, quantity: number) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  if (!Number.isInteger(cartItemId) || cartItemId <= 0 || !Number.isInteger(quantity)) {
    return { success: false, error: 'Data keranjang tidak valid' };
  }

  const userId = Number(session.user.id);

  try {
    const rows = await db
      .select()
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)))
      .limit(1);
    const row = rows[0];

    if (!row) return { success: false, error: 'Item keranjang tidak ditemukan' };

    if (quantity <= 0) {
      await db.delete(cartItems).where(
        and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)),
      );
    } else {
      const availableStock = row.product_variants?.stock ?? row.products?.stock ?? 0;
      const isActive = row.product_variants
        ? row.product_variants.isActive
        : row.products?.isActive;

      if (!isActive) return { success: false, error: 'Produk atau varian tidak aktif' };
      if (quantity > availableStock) {
        return { success: false, error: `Stok tersisa ${availableStock}` };
      }

      await db
        .update(cartItems)
        .set({ quantity })
        .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)));
    }
    revalidatePath('/cart');
    revalidatePath('/checkout');
    return { success: true };
  } catch {
    return { success: false, error: 'Gagal update keranjang' };
  }
}

// Remove item from cart
export async function removeFromCart(cartItemId: number) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

  if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
    return { success: false, error: 'Data keranjang tidak valid' };
  }

  const userId = Number(session.user.id);

  try {
    const ownedRows = await db.select({ id: cartItems.id }).from(cartItems)
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)))
      .limit(1);
    if (ownedRows.length === 0) {
      return { success: false, error: 'Item keranjang tidak ditemukan' };
    }

    await db.delete(cartItems).where(
      and(eq(cartItems.id, cartItemId), eq(cartItems.userId, userId)),
    );
    revalidatePath('/cart');
    revalidatePath('/checkout');
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
