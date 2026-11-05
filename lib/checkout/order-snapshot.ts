import { createHash } from 'node:crypto';

export type CheckoutSnapshotInput = {
  address: {
    id: number;
    userId: number;
    recipientName: string;
    phone: string;
    address: string;
    detail: string | null;
    latitude: string | null;
    longitude: string | null;
  };
  items: Array<{
    productId: number;
    variantId: number | null;
    quantity: number;
    unitWeight: number;
    unitPrice: number;
  }>;
};

/** Ensures the cart and owned address did not change between Biteship quote
 * and committing the order. Normalizes order so DB query order does not matter.
 */
export function checkoutSnapshotDigest(input: CheckoutSnapshotInput): string {
  const items = input.items.map(item => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    unitWeight: item.unitWeight,
    unitPrice: item.unitPrice,
  })).sort((a, b) => (a.productId - b.productId) ||
    ((a.variantId ?? -1) - (b.variantId ?? -1)) ||
    (a.quantity - b.quantity));

  return createHash('sha256').update(JSON.stringify({
    address: input.address,
    items,
  })).digest('hex');
}
