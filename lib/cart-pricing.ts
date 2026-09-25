import { resolveProductPrice } from '@/lib/product-pricing';

type CartPriceItem = {
  quantity: number | null;
  product: {
    price: string | number;
    salePrice?: string | number | null;
    saleStartsAt?: Date | string | null;
    saleEndsAt?: Date | string | null;
  };
  variant?: {
    priceModifier: string | number | null;
    salePriceOverride?: string | number | null;
  } | null;
};

export function getEffectiveUnitPrice(
  basePrice: string | number,
  priceModifier?: string | number | null,
  promotion?: Omit<CartPriceItem['product'], 'price'> & { variantSalePriceOverride?: string | number | null },
): number {
  return resolveProductPrice({
    price: basePrice,
    priceModifier,
    salePrice: promotion?.salePrice,
    saleStartsAt: promotion?.saleStartsAt,
    saleEndsAt: promotion?.saleEndsAt,
    variantSalePriceOverride: promotion?.variantSalePriceOverride,
  }).finalPrice;
}

export function calculateCartSubtotal(items: CartPriceItem[]): number {
  return items.reduce((sum, item) => {
    const unitPrice = resolveProductPrice({
      ...item.product,
      priceModifier: item.variant?.priceModifier,
      variantSalePriceOverride: item.variant?.salePriceOverride,
    }).finalPrice;
    return sum + unitPrice * (item.quantity ?? 0);
  }, 0);
}
