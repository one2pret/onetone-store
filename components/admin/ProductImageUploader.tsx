"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  uploadProductImage,
  setImageAsPrimary,
  deleteProductImage,
  updateImageVariantColor,
} from "@/app/actions/product-images";
import type { ProductImage } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

function ImageWithFallback({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      className="object-cover"
      sizes="(max-width: 640px) 50vw, 33vw"
      onError={() => setFailed(true)}
    />
  );
}

interface ImageWithUrl extends ProductImage {
  url: string;
  thumbUrl: string | null;
}

interface Props {
  productId: number;
  initialImages: ImageWithUrl[];
  /** Warna-warna yang tersedia dari varian produk */
  variantColors?: string[];
}

export function ProductImageUploader({ productId, initialImages, variantColors = [] }: Props) {
  const [images, setImages] = useState<ImageWithUrl[]>(initialImages);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const invalid = fileArray.filter(
      (f) => !f.type.startsWith("image/") || f.size > 10 * 1024 * 1024
    );
    if (invalid.length > 0) {
      toast.error("File harus gambar, maksimal 10MB");
      return;
    }

    startTransition(async () => {
      for (const file of fileArray) {
        const fd = new FormData();
        fd.append("image", file);
        const result = await uploadProductImage(productId, fd);

        if (result.success && result.data) {
          setImages((prev) => [
            ...prev,
            {
              id: result.data!.id,
              productId,
              objectKey: "",
              objectKeyOriginal: null,
              objectKeyThumb: null,
              filenameOriginal: file.name,
              mime: "image/webp",
              width: null,
              height: null,
              filesize: null,
              checksum: null,
              sortOrder: prev.length,
              isPrimary: result.data!.isPrimary,
              variantColor: null,
              createdAt: new Date(),
              url: result.data!.url,
              thumbUrl: result.data!.thumbUrl,
            },
          ]);
          toast.success(`${file.name} berhasil diupload`);
        } else {
          toast.error(result.error ?? "Gagal upload");
        }
      }
    });
  }

  function handleSetPrimary(imageId: number) {
    startTransition(async () => {
      const result = await setImageAsPrimary(imageId, productId);
      if (result.success) {
        setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === imageId })));
        toast.success("Gambar utama diubah");
      } else {
        toast.error(result.error ?? "Gagal");
      }
    });
  }

  function handleDelete(imageId: number) {
    if (!confirm("Hapus gambar ini?")) return;
    startTransition(async () => {
      const result = await deleteProductImage(imageId);
      if (result.success) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        toast.success("Gambar dihapus");
      } else {
        toast.error(result.error ?? "Gagal hapus");
      }
    });
  }

  function handleColorChange(imageId: number, color: string) {
    const variantColor = color === "" ? null : color;
    startTransition(async () => {
      const result = await updateImageVariantColor(imageId, variantColor);
      if (result.success) {
        setImages((prev) =>
          prev.map((img) => (img.id === imageId ? { ...img, variantColor } : img))
        );
      } else {
        toast.error(result.error ?? "Gagal simpan warna");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-[#51B1A6] bg-[#51B1A6]/5"
            : "border-gray-200 hover:border-[#51B1A6] hover:bg-gray-50",
          isPending && "opacity-50 pointer-events-none"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {isPending ? (
            <p className="text-sm text-gray-500">Mengupload...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">Klik atau drag foto ke sini</p>
              <p className="text-xs text-gray-400">JPEG, PNG, WebP, HEIC — Maks 10MB</p>
            </>
          )}
        </div>
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className={cn(
                "rounded-xl border-2 transition-colors overflow-hidden",
                img.isPrimary ? "border-[#51B1A6]" : "border-transparent"
              )}
            >
              {/* Gambar */}
              <div className="relative group aspect-square bg-gray-50">
                <ImageWithFallback
                  src={img.thumbUrl ?? img.url}
                  alt={img.filenameOriginal ?? "Foto produk"}
                />

                {img.isPrimary && (
                  <div className="absolute top-1.5 left-1.5 bg-[#51B1A6] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full z-10">
                    Utama
                  </div>
                )}

                {img.variantColor && (
                  <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full z-10 max-w-[80px] truncate">
                    {img.variantColor}
                  </div>
                )}

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                  {!img.isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(img.id)}
                      disabled={isPending}
                      className="bg-white text-gray-800 text-xs px-2 py-1 rounded-lg hover:bg-[#51B1A6] hover:text-white transition-colors"
                    >
                      Utama
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(img.id)}
                    disabled={isPending}
                    className="bg-white text-red-600 text-xs px-2 py-1 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              {/* Color tag selector — di bawah gambar */}
              {variantColors.length > 0 && (
                <div className="px-2 py-1.5 bg-card border-t border-border">
                  <select
                    value={img.variantColor ?? ""}
                    onChange={(e) => handleColorChange(img.id, e.target.value)}
                    disabled={isPending}
                    className="w-full text-xs h-6 rounded border border-input bg-background text-foreground px-1 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— Semua warna —</option>
                    {variantColors.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {variantColors.length > 0 && images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Assign setiap foto ke warna varian — saat customer pilih warna, foto yang sesuai akan tampil otomatis.
        </p>
      )}

      {images.length === 0 && !isPending && (
        <p className="text-sm text-gray-400 text-center">
          Belum ada foto. Upload minimal 1 foto produk.
        </p>
      )}
    </div>
  );
}
