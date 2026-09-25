export type ProductPricingInput = {
  price: string | number;
  salePrice?: string | number | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  priceModifier?: string | number | null;
  variantSalePriceOverride?: string | number | null;
};

export type ProductPricing = {
  regularPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercent: number;
  isOnSale: boolean;
  saleEndsAt: Date | null;
};

function validDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveProductPrice(
  input: ProductPricingInput,
  now = new Date(),
): ProductPricing {
  const regularPrice = Number(input.price) + Number(input.priceModifier ?? 0);
  const startsAt = validDate(input.saleStartsAt);
  const endsAt = validDate(input.saleEndsAt);
  const scheduled = (!startsAt || now >= startsAt) && (!endsAt || now <= endsAt);
  // Variant override belongs to the product promotion and must not activate by itself.
  const candidate = input.salePrice === null || input.salePrice === undefined || input.salePrice === ''
    ? null
    : (input.variantSalePriceOverride ?? input.salePrice);
  const promotionalPrice = candidate === null || candidate === undefined || candidate === ''
    ? null
    : Number(candidate);
  const isOnSale = scheduled
    && promotionalPrice !== null
    && Number.isFinite(promotionalPrice)
    && promotionalPrice >= 0
    && promotionalPrice < regularPrice;
  const finalPrice = isOnSale ? promotionalPrice : regularPrice;
  const discountAmount = Math.max(0, regularPrice - finalPrice);

  return {
    regularPrice,
    finalPrice,
    discountAmount,
    discountPercent: regularPrice > 0 ? Math.round((discountAmount / regularPrice) * 100) : 0,
    isOnSale,
    saleEndsAt: endsAt,
  };
}
