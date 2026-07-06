"use client";

import { useState } from "react";
import Link from "next/link";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { AddToCartButton } from "./AddToCartButton";
import { formatRupiah } from "@/lib/utils";
import { Truck, Shield, Tag } from "lucide-react";

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
  productName: string;
  categoryName?: string | null;
  categorySlug?: string | null;
  description?: string | null;
  basePrice: number;
  variants: Variant[];
  initialStock: number;
  images: GalleryImage[];
}

// Parse deskripsi produk yang format Tokopedia/Shopee-style
// Contoh: "--- Judul --- #Bahan ... - item - item #Lainnya ..."
function parseDescription(raw: string) {
  const sections: { title: string; items: string[] }[] = [];
  let intro = "";

  // Pisahkan bagian --- ... ---
  const cleaned = raw.replace(/---+/g, "§").trim();
  const parts = cleaned.split("§").map((p) => p.trim()).filter(Boolean);

  // Bagian pertama sebelum # pertama adalah intro
  const firstHash = parts[0]?.indexOf("#");
  if (firstHash !== undefined && firstHash > 0) {
    intro = parts[0].slice(0, firstHash).trim();
  } else if (!parts[0]?.startsWith("#")) {
    intro = parts[0] ?? "";
  }

  // Gabungkan semua ke satu string untuk parsing section
  const allText = parts.join(" ");

  // Split by # untuk dapat sections
  const rawSections = allText.split("#").map((s) => s.trim()).filter(Boolean);

  for (const sec of rawSections) {
    // Baris pertama = judul section
    const lineBreak = sec.search(/[\n\-]/);
    if (lineBreak === -1) {
      // Tidak ada items, cuma judul
      const title = sec.trim();
      if (title && !intro.includes(title)) {
        sections.push({ title, items: [] });
      }
      continue;
    }

    const title = sec.slice(0, lineBreak).trim();
    const rest = sec.slice(lineBreak).trim();

    // Parse items yang diawali " - "
    const items = rest
      .split(/\s*-\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    if (title) {
      sections.push({ title, items });
    }
  }

  return { intro, sections };
}

function ProductDescription({ raw }: { raw: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!raw) {
    return <p className="text-sm text-muted-foreground">Tidak ada deskripsi.</p>;
  }

  const hasStructure = raw.includes("#") || raw.includes("---");

  if (!hasStructure) {
    // Plain text — truncate dengan "Selengkapnya"
    const isLong = raw.length > 300;
    return (
      <div className="text-sm text-foreground/80 leading-relaxed">
        <p className={!expanded && isLong ? "line-clamp-4" : ""}>{raw}</p>
        {isLong && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 text-primary text-xs font-medium hover:underline"
          >
            {expanded ? "Sembunyikan" : "Selengkapnya"}
          </button>
        )}
      </div>
    );
  }

  const { intro, sections } = parseDescription(raw);
  const hasContent = sections.length > 0;

  return (
    <div className="space-y-3">
      {/* Intro text */}
      {intro && (
        <p className="text-sm text-foreground/80 leading-relaxed italic border-l-2 border-primary/30 pl-3">
          {intro}
        </p>
      )}

      {/* Structured sections */}
      {hasContent && (
        <div className={`space-y-3 ${!expanded ? "max-h-48 overflow-hidden relative" : ""}`}>
          {!expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
          )}
          {sections.map((sec, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                {sec.title}
              </p>
              {sec.items.length > 0 ? (
                <ul className="space-y-0.5 pl-3">
                  {sec.items.map((item, j) => (
                    <li key={j} className="text-sm text-foreground/75 leading-relaxed flex gap-2">
                      <span className="text-primary mt-1.5 shrink-0">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((e) => !e)}
        className="text-primary text-xs font-medium hover:underline"
      >
        {expanded ? "Sembunyikan" : "Lihat detail lengkap"}
      </button>
    </div>
  );
}

export function ProductDetail({
  productId,
  productName,
  categoryName,
  categorySlug,
  description,
  basePrice,
  variants,
  initialStock,
  images,
}: Props) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState(basePrice);

  function handleVariantChange(variantId: number | null, price: number, stock: number) {
    setCurrentPrice(price);
    // forward ke AddToCartButton — handled internally
    void variantId; void stock;
  }

  return (
    <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
      {/* ── Kolom kiri: Gallery ─────────────────── */}
      <ProductGallery
        images={images}
        productName={productName}
        selectedColor={selectedColor}
      />

      {/* ── Kolom kanan: Info + Varian + Beli ───── */}
      <div className="space-y-5">
        {/* Category */}
        {categoryName && (
          <Link
            href={categorySlug ? `/products?category=${categorySlug}` : "/products"}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Tag className="w-3 h-3" />
            {categoryName}
          </Link>
        )}

        {/* Product name */}
        <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-snug">
          {productName}
        </h1>

        {/* Price — updates when variant selected */}
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-primary">
            {formatRupiah(currentPrice)}
          </span>
        </div>

        <hr className="border-border" />

        {/* Variant selector + Add to cart */}
        <AddToCartButton
          productId={productId}
          basePrice={basePrice}
          variants={variants}
          initialStock={initialStock}
          onColorChange={setSelectedColor}
          onVariantPriceChange={handleVariantChange}
        />

        <hr className="border-border" />

        {/* Description */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Deskripsi Produk
          </p>
          <ProductDescription raw={description ?? ""} />
        </div>

        {/* Features */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Truck className="w-4 h-4 text-primary shrink-0" />
            Pengiriman ke seluruh Indonesia
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            Produk 100% original
          </div>
        </div>
      </div>
    </div>
  );
}
