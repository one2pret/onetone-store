"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";

interface GalleryImage {
  id: number;
  url: string;
  thumbUrl: string | null;
  isPrimary: boolean;
  variantColor: string | null;
}

interface Props {
  images: GalleryImage[];
  productName: string;
  selectedColor: string | null;
}

export function ProductGallery({ images, productName, selectedColor }: Props) {
  const primaryImage = images.find((i) => i.isPrimary) ?? images[0] ?? null;

  // Pilih gambar yang aktif berdasarkan warna yang dipilih
  const resolveActive = (color: string | null) => {
    if (color) {
      const match = images.find((i) => i.variantColor === color);
      if (match) return match;
    }
    return primaryImage;
  };

  const [active, setActive] = useState<GalleryImage | null>(() => resolveActive(selectedColor));

  // Update gambar saat warna berubah (dari parent/VariantSelector)
  useEffect(() => {
    setActive(resolveActive(selectedColor));
  }, [selectedColor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-slate-100 rounded-xl flex items-center justify-center">
        <ShoppingBag className="w-24 h-24 text-slate-300" />
      </div>
    );
  }

  const displayUrl = active?.url ?? primaryImage?.url ?? "";

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="aspect-square bg-slate-100 rounded-xl relative overflow-hidden">
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt={productName}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-all duration-300"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-24 h-24 text-slate-300" />
          </div>
        )}
      </div>

      {/* Thumbnail strip — tampil hanya jika lebih dari 1 gambar */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {images.map((img) => (
            <button
              key={img.id}
              onClick={() => setActive(img)}
              className={[
                "shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden relative transition-all",
                active?.id === img.id
                  ? "border-primary shadow-sm"
                  : "border-transparent hover:border-slate-300",
              ].join(" ")}
            >
              <Image
                src={img.thumbUrl ?? img.url}
                alt={img.variantColor ?? productName}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
