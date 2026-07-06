"use server";

// app/actions/drive-import.ts
// Server Action: import foto dari Google Drive → proses → R2 → simpan ke product_images

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/db/schema";
import { storage, generateObjectKey } from "@/lib/storage";
import { processProductImage } from "@/lib/image-processor";
import { downloadBatchFromDrive } from "@/lib/drive-import";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

export async function importFromDrive(
  productId: number,
  fileIds: string[],
  accessToken: string
): Promise<ImportResult> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, imported: 0, failed: 0, errors: ["Forbidden"] };
  }

  if (!fileIds.length) {
    return { success: false, imported: 0, failed: 0, errors: ["Tidak ada file dipilih"] };
  }

  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });
  if (!product) {
    return { success: false, imported: 0, failed: 0, errors: ["Produk tidak ditemukan"] };
  }

  const downloads = await downloadBatchFromDrive(fileIds, accessToken, 3);

  const existing = await db
    .select({ id: productImages.id, checksum: productImages.checksum })
    .from(productImages)
    .where(eq(productImages.productId, productId));

  const existingChecksums = new Set(existing.map((e) => e.checksum).filter(Boolean));
  let sortOrder = existing.length;
  let isFirstImage = existing.length === 0;

  const errors: string[] = [];
  let imported = 0;

  const folderPath = `products/${product.slug}`;

  for (const dl of downloads) {
    if (!dl.result) {
      errors.push(dl.error ?? "Download gagal");
      continue;
    }

    try {
      const processed = await processProductImage(dl.result.buffer);

      const mainResult = await storage.upload(
        generateObjectKey(folderPath, "webp"),
        processed.main.buffer,
        "image/webp"
      );

      if (existingChecksums.has(mainResult.checksum)) {
        await storage.delete(mainResult.objectKey);
        errors.push(`${dl.result.filename}: duplikat, dilewati`);
        continue;
      }
      existingChecksums.add(mainResult.checksum);

      const [thumbResult, originalResult] = await Promise.all([
        storage.upload(
          generateObjectKey(`${folderPath}/thumb`, "webp"),
          processed.thumb.buffer,
          "image/webp"
        ),
        storage.upload(
          generateObjectKey(`${folderPath}/original`, processed.original.format),
          processed.original.buffer,
          dl.result.mimeType
        ),
      ]);

      await db.insert(productImages).values({
        productId,
        objectKey: mainResult.objectKey,
        objectKeyOriginal: originalResult.objectKey,
        objectKeyThumb: thumbResult.objectKey,
        filenameOriginal: dl.result.filename,
        mime: "image/webp",
        width: processed.main.width,
        height: processed.main.height,
        filesize: processed.main.filesize,
        checksum: mainResult.checksum,
        sortOrder: sortOrder++,
        isPrimary: isFirstImage,
      });

      isFirstImage = false;
      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Proses gagal";
      errors.push(`${dl.result.filename}: ${msg}`);
    }
  }

  revalidatePath(`/dashboard/products/${productId}/edit`);
  revalidatePath("/dashboard/products");

  return {
    success: imported > 0,
    imported,
    failed: downloads.length - imported,
    errors,
  };
}
