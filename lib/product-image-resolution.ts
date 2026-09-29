export type ProductImageCandidate = {
  id: number;
  variantId: number | null;
  variantColor: string | null;
  isPrimary: boolean | null;
  sortOrder: number | null;
  objectKey: string;
  objectKeyThumb: string | null;
};

export type ImageVariant = {
  id: number;
  color: string;
};

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase('id-ID') ?? '';
}

function ordered(images: ProductImageCandidate[]) {
  return [...images].sort((left, right) =>
    (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
    || left.id - right.id,
  );
}

/** Exact variant wins, followed by the legacy color tag and product fallbacks. */
export function selectProductImage(
  images: ProductImageCandidate[],
  variant?: ImageVariant | null,
): ProductImageCandidate | null {
  const candidates = ordered(images);
  if (variant) {
    const exact = candidates.find(image => image.variantId === variant.id);
    if (exact) return exact;

    const legacyColor = candidates.find(image =>
      image.variantId === null
      && normalized(image.variantColor) !== ''
      && normalized(image.variantColor) === normalized(variant.color),
    );
    if (legacyColor) return legacyColor;
  }

  return candidates.find(image => image.isPrimary) ?? candidates[0] ?? null;
}

export function preferredProductImageKey(image: ProductImageCandidate | null) {
  return image?.objectKeyThumb || image?.objectKey || null;
}
