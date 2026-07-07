// lib/storage.ts
// Cloudflare R2 abstraction layer — SEMUA upload/delete/getUrl lewat file ini

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";

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

export interface UploadResult {
  objectKey: string;
  url: string;
  filesize: number;
  checksum: string;
}

export function generateObjectKey(folder: string, ext: string = "webp"): string {
  const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${folder}/${uuid}.${ext}`;
}

export function computeChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function getPublicUrl(objectKey: string): string {
  return `${CDN_URL}/${objectKey}`;
}

export const storage = {
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
        // Filename UUID = immutable per URL → aman cache selamanya di browser & CDN edge.
        // Setelah first load, gambar diambil dari cache (0 request ke R2).
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { checksum },
      })
    );

    return {
      objectKey,
      url: getPublicUrl(objectKey),
      filesize: body.byteLength,
      checksum,
    };
  },

  async delete(objectKey: string): Promise<void> {
    try {
      await r2Client.send(
        new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey })
      );
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "NoSuchKey") throw err;
    }
  },

  async exists(objectKey: string): Promise<boolean> {
    try {
      await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: objectKey }));
      return true;
    } catch {
      return false;
    }
  },

  getUrl: getPublicUrl,
};
