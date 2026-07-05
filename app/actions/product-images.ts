"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/db/schema";
import { storage, generateObjectKey } from "@/lib/storage";
import { processProductImage, detectMimeFromBuffer } from "@/lib/image-processor";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Sync products.image dengan CDN URL dari primary image R2
async function syncProductPrimaryImage(productId: number, cdnUrl: string | null) {
  await db
    .update(products)
    .set({ image: cdnUrl ?? "" })
    .where(eq(products.id, productId));
}

export async function uploadProductImage(productId: number, formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, error: "Forbidden" };
  }

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    return { success: false, error: "File tidak ditemukan" };
  }

  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });
  if (!product) {
    return { success: false, error: "Produk tidak ditemukan" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = detectMimeFromBuffer(buffer);
    const processed = await processProductImage(buffer);

    const folderPath = `products/${product.slug}`;

    const [mainResult, thumbResult, originalResult] = await Promise.all([
      storage.upload(generateObjectKey(folderPath, "webp"), processed.main.buffer, "image/webp"),
      storage.upload(generateObjectKey(`${folderPath}/thumb`, "webp"), processed.thumb.buffer, "image/webp"),
      storage.upload(generateObjectKey(`${folderPath}/original`, processed.original.format), processed.original.buffer, mime),
    ]);

    const existingImages = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.productId, productId));
    const isPrimary = existingImages.length === 0;

    const [inserted] = await db.insert(productImages).values({
      productId,
      objectKey: mainResult.objectKey,
      objectKeyOriginal: originalResult.objectKey,
      objectKeyThumb: thumbResult.objectKey,
      filenameOriginal: file.name,
      mime: "image/webp",
      width: processed.main.width,
      height: processed.main.height,
      filesize: processed.main.filesize,
      checksum: mainResult.checksum,
      sortOrder: existingImages.length,
      isPrimary,
    }).$returningId();

    // Jika ini gambar pertama (otomatis primary), sync ke products.image
    if (isPrimary) {
      await syncProductPrimaryImage(productId, mainResult.url);
    }

    revalidatePath(`/dashboard/products/${productId}/edit`);
    revalidatePath("/dashboard/products");
    revalidatePath(`/products/${product.slug}`);

    return {
      success: true,
      data: {
        id: inserted.id,
        url: mainResult.url,
        thumbUrl: thumbResult.url,
        isPrimary,
      },
    };
  } catch (err) {
    console.error("[uploadProductImage]", err);
    const message = err instanceof Error ? err.message : "Gagal upload gambar";
    return { success: false, error: message };
  }
}

export async function setImageAsPrimary(imageId: number, productId: number) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, error: "Forbidden" };
  }

  // Ambil URL gambar yang dipilih
  const image = await db.query.productImages.findFirst({
    where: eq(productImages.id, imageId),
  });
  if (!image) return { success: false, error: "Gambar tidak ditemukan" };

  await db.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
  await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, imageId));

  // Sync products.image dengan CDN URL gambar primary baru
  await syncProductPrimaryImage(productId, storage.getUrl(image.objectKey));

  // Ambil slug untuk revalidate customer page
  const product = await db.query.products.findFirst({ where: eq(products.id, productId) });

  revalidatePath(`/dashboard/products/${productId}/edit`);
  revalidatePath("/dashboard/products");
  if (product) revalidatePath(`/products/${product.slug}`);

  return { success: true };
}

export async function deleteProductImage(imageId: number) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, error: "Forbidden" };
  }

  const image = await db.query.productImages.findFirst({
    where: eq(productImages.id, imageId),
  });
  if (!image) return { success: false, error: "Gambar tidak ditemukan" };

  await Promise.allSettled([
    image.objectKey && storage.delete(image.objectKey),
    image.objectKeyThumb && storage.delete(image.objectKeyThumb),
    image.objectKeyOriginal && storage.delete(image.objectKeyOriginal),
  ]);

  await db.delete(productImages).where(eq(productImages.id, imageId));

  // Jika yang dihapus adalah primary, promosi gambar berikutnya
  if (image.isPrimary) {
    const next = await db.query.productImages.findFirst({
      where: eq(productImages.productId, image.productId),
      orderBy: asc(productImages.sortOrder),
    });
    if (next) {
      await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, next.id));
      await syncProductPrimaryImage(image.productId, storage.getUrl(next.objectKey));
    } else {
      // Tidak ada gambar lagi, kosongkan products.image
      await syncProductPrimaryImage(image.productId, null);
    }
  }

  const product = await db.query.products.findFirst({ where: eq(products.id, image.productId) });

  revalidatePath(`/dashboard/products/${image.productId}/edit`);
  revalidatePath("/dashboard/products");
  if (product) revalidatePath(`/products/${product.slug}`);

  return { success: true };
}

export async function updateImageVariantColor(imageId: number, variantColor: string | null) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, error: "Forbidden" };
  }

  const image = await db.query.productImages.findFirst({
    where: eq(productImages.id, imageId),
  });
  if (!image) return { success: false, error: "Gambar tidak ditemukan" };

  await db.update(productImages).set({ variantColor }).where(eq(productImages.id, imageId));

  revalidatePath(`/dashboard/products/${image.productId}/edit`);
  return { success: true };
}

export async function getProductImages(productId: number) {
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder));

  return images.map((img) => ({
    ...img,
    url: storage.getUrl(img.objectKey),
    thumbUrl: img.objectKeyThumb ? storage.getUrl(img.objectKeyThumb) : null,
  }));
}
