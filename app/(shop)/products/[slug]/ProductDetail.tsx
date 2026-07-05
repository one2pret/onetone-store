"use client";

import { useState } from "react";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { AddToCartButton } from "./AddToCartButton";

interface GalleryImage {
  id: number;
  url: string;
  thumbUrl: string | null;
  isPrimary: boolean;
  variantColor: string | null;
}

interface Variant {
  id: number;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  stock: number;
  priceModifier: string | null;
}

interface Props {
  productId: number;
  basePrice: number;
  variants: Variant[];
  initialStock: number;
  images: GalleryImage[];
  productName: string;
}

export function ProductDetail({ productId, basePrice, variants, initialStock, images, productName }: Props) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  return (
    <>
      <ProductGallery
        images={images}
        productName={productName}
        selectedColor={selectedColor}
      />
      <AddToCartButton
        productId={productId}
        basePrice={basePrice}
        variants={variants}
        initialStock={initialStock}
        onColorChange={setSelectedColor}
      />
    </>
  );
}
