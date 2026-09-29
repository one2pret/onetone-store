export type PosCartProductInput = {
  id: number;
  name: string;
  posName: string | null;
  price: string;
  stock: number | null;
  image: string | null;
  regularPrice: number;
  finalPrice: number;
  discountPercent: number;
  isOnSale: boolean;
};

export type PosCartVariantInput = {
  id: number;
  size: string;
  color: string;
  stock: number;
  priceModifier: string | null;
  posLabel: string | null;
  image: string | null;
  regularPrice: number;
  finalPrice: number;
  discountPercent: number;
  isOnSale: boolean;
};

export function buildPosCartLine(product: PosCartProductInput, variant?: PosCartVariantInput) {
  const pricing = variant ?? product;
  const unitPrice = pricing.finalPrice;
  return {
    key: variant ? `${product.id}-${variant.id}` : `${product.id}`,
    productId: product.id,
    variantId: variant?.id,
    productName: product.posName?.trim() || product.name,
    variantLabel: variant ? (variant.posLabel?.trim() || `${variant.size} / ${variant.color}`) : null,
    image: variant?.image || product.image,
    unitPrice,
    regularUnitPrice: pricing.regularPrice,
    automaticDiscountAmount: pricing.regularPrice - pricing.finalPrice,
    quantity: 1,
    maxStock: variant ? variant.stock : product.stock ?? 0,
  };
}
