"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  uploadProductImage,
  setImageAsPrimary,
  deleteProductImage,
} from "@/app/actions/product-images";
import type { ProductImage } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface ImageWithUrl extends ProductImage {
  url: string;
  thumbUrl: string | null;
}

interface Props {
  productId: number;
  initialImages: ImageWithUrl[];
}

export function ProductImageUploader({ productId, initialImages }: Props) {
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
        setImages((prev) =>
          prev.map((img) => ({ ...img, isPrimary: img.id === imageId }))
        );
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

  return (
    <div className="space-y-4">
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

      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className={cn(
                "relative group rounded-xl overflow-hidden border-2 transition-colors",
                img.isPrimary ? "border-[#51B1A6]" : "border-transparent"
              )}
            >
              <div className="aspect-square relative bg-gray-50">
                <Image
                  src={img.thumbUrl ?? img.url}
                  alt={img.filenameOriginal ?? "Foto produk"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, 25vw"
                />
              </div>

              {img.isPrimary && (
                <div className="absolute top-1.5 left-1.5 bg-[#51B1A6] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                  Utama
                </div>
              )}

              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
          ))}
        </div>
      )}

      {images.length === 0 && !isPending && (
        <p className="text-sm text-gray-400 text-center">
          Belum ada foto. Upload minimal 1 foto produk.
        </p>
      )}
    </div>
  );
}
