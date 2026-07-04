"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/db/schema";
import { storage, generateObjectKey } from "@/lib/storage";
import { processProductImage, detectMimeFromBuffer } from "@/lib/image-processor";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

    revalidatePath(`/dashboard/products/${productId}/edit`);
    revalidatePath("/dashboard/products");

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

  await db.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
  await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, imageId));

  revalidatePath(`/dashboard/products/${productId}/edit`);
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
