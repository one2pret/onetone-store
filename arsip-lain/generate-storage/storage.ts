// lib/storage.ts
// Cloudflare R2 abstraction layer — SEMUA upload/delete/getUrl lewat file ini
// Kompatibel S3 API — ganti provider nanti tanpa ubah kode lain

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";

// ─── R2 Client ────────────────────────────────────────────────────────────────

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL!;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  objectKey: string;
  url: string;
  filesize: number;
  checksum: string;
}

export interface UploadOptions {
  /** Override generated filename. Harus include extension. */
  filename?: string;
  /** Content-Type. Default: image/webp */
  contentType?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate UUID-based object key. Contoh: products/kaos-polo/a1b2c3d4.webp */
export function generateObjectKey(
  folder: string,
  ext: string = "webp"
): string {
  const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${folder}/${uuid}.${ext}`;
}

/** Checksum SHA256 dari buffer */
export function computeChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/** Rekonstruksi public URL dari objectKey */
export function getPublicUrl(objectKey: string): string {
  return `${CDN_URL}/${objectKey}`;
}

// ─── Core Storage Operations ──────────────────────────────────────────────────

export const storage = {
  /**
   * Upload buffer ke R2.
   * @param objectKey  Path di bucket: "products/slug/uuid.webp"
   * @param body       File buffer
   * @param contentType  MIME type
   */
  async upload(
    objectKey: string,
    body: Buffer,
    contentType: string = "image/webp"
  ): Promise<UploadResult> {
    const checksum = computeChecksum(body);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        Metadata: {
          checksum,
        },
      })
    );

    return {
      objectKey,
      url: getPublicUrl(objectKey),
      filesize: body.byteLength,
      checksum,
    };
  },

  /**
   * Hapus file dari R2.
   * Tidak throw error jika file tidak ditemukan (idempotent).
   */
  async delete(objectKey: string): Promise<void> {
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: objectKey,
        })
      );
    } catch (err: unknown) {
      // Abaikan NotFound — file memang sudah tidak ada
      if ((err as { name?: string }).name !== "NoSuchKey") {
        throw err;
      }
    }
  },

  /**
   * Cek apakah file exists di R2.
   */
  async exists(objectKey: string): Promise<boolean> {
    try {
      await r2Client.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: objectKey })
      );
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Rekonstruksi URL publik dari objectKey.
   * Gunakan ini saat render gambar — jangan simpan full URL di DB.
   */
  getUrl: getPublicUrl,
};
