import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  users, addresses, cartItems, products, productVariants, orders, orderItems,
  shippings, inventoryLocations, inventoryBalances, inventoryMovements,
} from '@/lib/db/schema';
import { resolveProductPrice } from '@/lib/product-pricing';
import { checkoutSnapshotDigest } from './order-snapshot';
import { calculateCheckoutBusinessTotals, CheckoutBusinessTotalsError } from './business-totals';
import { loadLockedCheckoutMembership, debitCheckoutMembershipPoints } from './transactional-membership-points';

export class CheckoutRejected extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

type SelectedShipping = {
  courierName: string; courierCompany: string; courierType: string; price: number;
};
/** Explicitly opted-in financial scope; vouchers and affiliates remain a later PR. */
export type CheckoutMemberPointsSelection = {
  kind: 'membership-points-v1';
  pointsToRedeem: number;
};

export type CommittedOrder = {
  created: boolean; orderId: number; orderNumber: string; total: number;
};

/**
 * Shared atomic order, inventory and cart commit engine.
 *
 * For now this function is used ONLY by the existing staging sandbox order
 * route through its backwards-compatible commitSandboxOrder export.
 *
 * NOT production-ready: legacy web checkout still has voucher/affiliate effects
 * and payment recovery outside this transaction. An OPTIONAL membership-points
 * scope can be requested by an explicitly reviewed future staging caller.
 * Existing sandbox callers omit it and retain their original behavior.
 * Do not wire production routes to this function before end-to-end signoff.
 *
 * Never calls Xendit or Biteship inside the DB transaction.
 */
export async function commitOnlineOrderAtomically(args: {
  userId: number;
  addressId: number;
  orderNumber: string;
  snapshot: string;
  shipping: SelectedShipping;
  notes?: string | null;
  benefits?: CheckoutMemberPointsSelection;
}): Promise<CommittedOrder> {
  return db.transaction(async tx => {
    // Lock user to serialize retries with the same or different keys.
    const [lockedUser] = await tx.select({ id: users.id }).from(users)
      .where(eq(users.id, args.userId)).for('update');
    if (!lockedUser) throw new CheckoutRejected(401, 'Akun tidak ditemukan');
    const [previous] = await tx.select().from(orders)
      .where(eq(orders.orderNumber, args.orderNumber)).limit(1);
    if (previous) {
      if (previous.userId !== args.userId) throw new CheckoutRejected(409, 'Kunci checkout tidak valid');
      return { created: false, orderId: previous.id,
        orderNumber: previous.orderNumber, total: Number(previous.total) };
    }

    const [address] = await tx.select().from(addresses)
      .where(and(eq(addresses.id, args.addressId), eq(addresses.userId, args.userId)))
      .for('update').limit(1);
    if (!address) throw new CheckoutRejected(404, 'Alamat pengiriman tidak ditemukan');

    const cart = await tx.select().from(cartItems)
      .where(eq(cartItems.userId, args.userId))
      .orderBy(cartItems.productId, cartItems.variantId, cartItems.id)
      .for('update');
    if (cart.length === 0) throw new CheckoutRejected(422, 'Keranjang kosong');

    const now = new Date();
    const lines: Array<{
      productId: number; variantId: number | null; quantity: number;
      productName: string; image: string | null; variantLabel: string | null;
      unitWeight: number; price: ReturnType<typeof resolveProductPrice>;
    }> = [];

    for (const entry of cart) {
      const [product] = await tx.select().from(products)
        .where(eq(products.id, entry.productId)).for('update').limit(1);
      if (!product || !product.isActive || product.channel === 'store_only') {
        throw new CheckoutRejected(422, 'Produk tidak tersedia untuk online');
      }
      const quantity = entry.quantity ?? 0;
      if (!Number.isSafeInteger(quantity) || quantity <= 0 ||
          !Number.isSafeInteger(product.weight) || (product.weight ?? 0) <= 0) {
        throw new CheckoutRejected(422, 'Jumlah atau berat produk tidak valid');
      }
      const variant = entry.variantId
        ? (await tx.select().from(productVariants)
            .where(eq(productVariants.id, entry.variantId)).for('update').limit(1))[0]
        : null;
      if (entry.variantId && (!variant || !variant.isActive || variant.productId !== product.id)) {
        throw new CheckoutRejected(422, 'Varian tidak tersedia');
      }
      const price = resolveProductPrice({
        ...product, priceModifier: variant?.priceModifier,
        variantSalePriceOverride: variant?.salePriceOverride,
      }, now);
      if (!Number.isSafeInteger(price.finalPrice) || price.finalPrice < 0) {
        throw new CheckoutRejected(422, 'Harga tidak valid');
      }
      lines.push({
        productId: product.id, variantId: entry.variantId, quantity,
        productName: product.name, image: product.image,
        variantLabel: variant ? variant.size + ' / ' + variant.color : null,
        unitWeight: product.weight!, price,
      });
    }

    const currentSnapshot = checkoutSnapshotDigest({
      address: {
        id: address.id, userId: address.userId,
        recipientName: address.recipientName, phone: address.phone,
        address: address.address, detail: address.detail,
        latitude: address.latitude, longitude: address.longitude,
      },
      items: lines.map(line => ({
        productId: line.productId, variantId: line.variantId,
        quantity: line.quantity, unitWeight: line.unitWeight,
        unitPrice: line.price.finalPrice,
      })),
    });
    if (currentSnapshot !== args.snapshot) {
      throw new CheckoutRejected(409, 'Keranjang/harga/alamat berubah. Perbarui ongkir.');
    }

    const [location] = await tx.select({ id: inventoryLocations.id })
      .from(inventoryLocations)
      .where(and(eq(inventoryLocations.isOnlineDefault, true), eq(inventoryLocations.isActive, true)))
      .limit(1);
    if (!location) throw new CheckoutRejected(422, 'Gudang Online belum dikonfigurasi');

    const subtotal = lines.reduce((sum, line) => sum + line.price.finalPrice * line.quantity, 0);
    let total = subtotal + args.shipping.price;
    let actualShippingCost = args.shipping.price;
    let lockedMember: Awaited<ReturnType<typeof loadLockedCheckoutMembership>> = null;
    let pointsToRedeem = 0;
    if (args.benefits !== undefined) {
      // Deliberately reject unsupported benefits instead of silently dropping
      // a caller's voucher, affiliate, or future discount policy.
      const selection = args.benefits;
      if (!selection || selection.kind !== 'membership-points-v1' ||
          Object.keys(selection).some(key => key !== 'kind' && key !== 'pointsToRedeem')) {
        throw new CheckoutRejected(422, 'Jenis keuntungan checkout belum didukung');
      }
      lockedMember = await loadLockedCheckoutMembership(tx, args.userId);
      try {
        const financial = calculateCheckoutBusinessTotals({
          subtotal,
          quotedShippingCost: args.shipping.price,
          voucher: null,
          tierFreeShippingThreshold: lockedMember?.freeShippingThreshold ?? null,
          pointsToRedeem: selection.pointsToRedeem,
          availablePoints: lockedMember?.points ?? null,
        });
        total = financial.total;
        actualShippingCost = financial.shippingCost;
        pointsToRedeem = financial.pointsRedeemed;
      } catch (error) {
        if (error instanceof CheckoutBusinessTotalsError) {
          throw new CheckoutRejected(422, 'Poin, tier, atau nilai pembayaran tidak valid: ' + error.code);
        }
        throw error;
      }
    }
    if (!Number.isSafeInteger(total) || total <= 0) throw new CheckoutRejected(422, 'Total tidak valid');

    const [inserted] = await tx.insert(orders).values({
      userId: args.userId, orderNumber: args.orderNumber,
      channel: 'online', status: 'waiting_payment',
      subtotal: String(subtotal), shippingCost: String(actualShippingCost),
      pointsRedeemed: pointsToRedeem,
      total: String(total), willExpiredAt: sql.raw('NOW() + INTERVAL 24 HOUR'),
      shippingName: address.recipientName, shippingPhone: address.phone,
      shippingAddress: address.address, notes: args.notes || null,
    });
    const orderId = Number(inserted.insertId);
    if (pointsToRedeem > 0) {
      if (!lockedMember) throw new CheckoutRejected(409, 'Akun membership tidak ditemukan');
      await debitCheckoutMembershipPoints(tx, {
        membershipId: lockedMember.id, orderId, points: pointsToRedeem,
      });
    }
    await tx.insert(orderItems).values(lines.map(line => ({
      orderId, productId: line.productId, variantId: line.variantId,
      productName: line.productName, productImage: line.image,
      variantLabel: line.variantLabel, price: String(line.price.finalPrice),
      unitWeightGrams: line.unitWeight,
      regularPrice: String(line.price.regularPrice),
      productDiscountAmount: String(line.price.discountAmount),
      quantity: line.quantity, subtotal: String(line.price.finalPrice * line.quantity),
    })));
    await tx.insert(shippings).values({
      orderId, recipientName: address.recipientName, phone: address.phone,
      address: address.address, addressDetail: address.detail,
      latitude: address.latitude, longitude: address.longitude,
      courierName: args.shipping.courierName,
      courierCompany: args.shipping.courierCompany,
      courierType: args.shipping.courierType,
      price: String(args.shipping.price),
    });

    // Conditional updates prevent negative balances even if stock was updated
    // between initial validation and this transaction; any failure rolls back.
    for (const line of lines) {
      const condition = and(
        eq(inventoryBalances.locationId, location.id),
        eq(inventoryBalances.productId, line.productId),
        line.variantId === null ? isNull(inventoryBalances.variantId)
          : eq(inventoryBalances.variantId, line.variantId),
      );
      const [balance] = await tx.select().from(inventoryBalances)
        .where(condition).for('update').limit(1);
      if (!balance || balance.quantity - line.quantity < balance.reserved) {
        throw new CheckoutRejected(409, 'Stok Gudang Online tidak mencukupi');
      }
      const [balanceUpdate] = await tx.update(inventoryBalances)
        .set({ quantity: sql.join([sql.raw('quantity - '), sql.param(line.quantity)]) })
        .where(and(eq(inventoryBalances.id, balance.id),
          gte(sql.raw('quantity - reserved'), line.quantity)));
      if (balanceUpdate.affectedRows !== 1) {
        throw new CheckoutRejected(409, 'Stok berubah. Ulangi checkout.');
      }

      if (line.variantId !== null) {
        const [variantUpdate] = await tx.update(productVariants)
          .set({ stock: sql.join([sql.raw('stock - '), sql.param(line.quantity)]) })
          .where(and(eq(productVariants.id, line.variantId),
            gte(productVariants.stock, line.quantity)));
        if (variantUpdate.affectedRows !== 1) {
          throw new CheckoutRejected(409, 'Stok varian tidak mencukupi');
        }
      } else {
        const [productUpdate] = await tx.update(products)
          .set({ stock: sql.join([sql.raw('stock - '), sql.param(line.quantity)]) })
          .where(and(eq(products.id, line.productId), gte(products.stock, line.quantity)));
        if (productUpdate.affectedRows !== 1) {
          throw new CheckoutRejected(409, 'Stok produk tidak mencukupi');
        }
      }
      await tx.insert(inventoryMovements).values({
        locationId: location.id, productId: line.productId,
        variantId: line.variantId, quantityDelta: -line.quantity,
        balanceAfter: balance.quantity - line.quantity,
        type: 'online_sale', referenceType: 'order', referenceId: orderId,
      });
    }
    await tx.delete(cartItems).where(eq(cartItems.userId, args.userId));
    return { created: true, orderId, orderNumber: args.orderNumber, total };
  });
}
