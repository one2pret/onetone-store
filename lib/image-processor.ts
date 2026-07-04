// lib/image-processor.ts
// Sharp wrapper — resize, compress, convert WebP

import sharp from "sharp";

export interface ProcessedImages {
  original: {
    buffer: Buffer;
    width: number;
    height: number;
    format: string;
    filesize: number;
  };
  main: {
    buffer: Buffer;
    width: number;
    height: number;
    filesize: number;
  };
  thumb: {
    buffer: Buffer;
    width: number;
    height: number;
    filesize: number;
  };
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_FILESIZE_MB = 10;

export function validateImageBuffer(buffer: Buffer): void {
  if (buffer.byteLength > MAX_FILESIZE_MB * 1024 * 1024) {
    throw new Error(`Ukuran file melebihi batas ${MAX_FILESIZE_MB}MB`);
  }
}

export function detectMimeFromBuffer(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return "image/webp";
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return "image/heic";
  }
  throw new Error("Format file tidak didukung. Gunakan JPEG, PNG, WebP, atau HEIC.");
}

export async function processProductImage(inputBuffer: Buffer): Promise<ProcessedImages> {
  validateImageBuffer(inputBuffer);
  const detectedMime = detectMimeFromBuffer(inputBuffer);
  if (!ALLOWED_MIME.includes(detectedMime)) {
    throw new Error("Format gambar tidak didukung");
  }

  const originalMeta = await sharp(inputBuffer).metadata();

  const mainBuffer = await sharp(inputBuffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const mainMeta = await sharp(mainBuffer).metadata();

  const thumbBuffer = await sharp(inputBuffer)
    .resize(400, 400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  const thumbMeta = await sharp(thumbBuffer).metadata();

  return {
    original: {
      buffer: inputBuffer,
      width: originalMeta.width ?? 0,
      height: originalMeta.height ?? 0,
      format: originalMeta.format ?? "unknown",
      filesize: inputBuffer.byteLength,
    },
    main: {
      buffer: mainBuffer,
      width: mainMeta.width ?? 0,
      height: mainMeta.height ?? 0,
      filesize: mainBuffer.byteLength,
    },
    thumb: {
      buffer: thumbBuffer,
      width: thumbMeta.width ?? 0,
      height: thumbMeta.height ?? 0,
      filesize: thumbBuffer.byteLength,
    },
  };
}
