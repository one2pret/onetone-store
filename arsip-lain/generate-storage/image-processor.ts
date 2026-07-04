// lib/image-processor.ts
// Sharp wrapper — resize, compress, convert WebP
// Selalu simpan original. Output: main (800px) + thumb (400px)

import sharp from "sharp";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedImages {
  /** File original — buffer asli dari upload */
  original: {
    buffer: Buffer;
    width: number;
    height: number;
    format: string;
    filesize: number;
  };
  /** Main image — WebP 800px max, quality 82 */
  main: {
    buffer: Buffer;
    width: number;
    height: number;
    filesize: number;
  };
  /** Thumbnail — WebP 400px max, quality 75 */
  thumb: {
    buffer: Buffer;
    width: number;
    height: number;
    filesize: number;
  };
}

// ─── Validator ────────────────────────────────────────────────────────────────

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_FILESIZE_MB = 10;

export function validateImageBuffer(buffer: Buffer): void {
  if (buffer.byteLength > MAX_FILESIZE_MB * 1024 * 1024) {
    throw new Error(`Ukuran file melebihi batas ${MAX_FILESIZE_MB}MB`);
  }
}

/** Detect MIME dari isi buffer — bukan dari ekstensi filename */
export function detectMimeFromBuffer(buffer: Buffer): string {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return "image/webp";
  // HEIC/HEIF: ftyp box
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return "image/heic";
  }
  throw new Error("Format file tidak didukung. Gunakan JPEG, PNG, WebP, atau HEIC.");
}

// ─── Core Processor ───────────────────────────────────────────────────────────

/**
 * Proses gambar upload menjadi 3 versi: original, main (800px WebP), thumb (400px WebP).
 * 
 * @example
 * const formData = await request.formData();
 * const file = formData.get("image") as File;
 * const buffer = Buffer.from(await file.arrayBuffer());
 * const processed = await processProductImage(buffer);
 */
export async function processProductImage(
  inputBuffer: Buffer
): Promise<ProcessedImages> {
  // 1. Validate
  validateImageBuffer(inputBuffer);
  const detectedMime = detectMimeFromBuffer(inputBuffer);
  if (!ALLOWED_MIME.includes(detectedMime)) {
    throw new Error("Format gambar tidak didukung");
  }

  // 2. Baca metadata original
  const originalMeta = await sharp(inputBuffer).metadata();

  // 3. Generate main image (800px max, WebP, quality 82)
  const mainBuffer = await sharp(inputBuffer)
    .resize(800, 800, {
      fit: "inside",
      withoutEnlargement: true, // Jangan perbesar gambar kecil
    })
    .webp({ quality: 82 })
    .toBuffer();

  const mainMeta = await sharp(mainBuffer).metadata();

  // 4. Generate thumbnail (400px max, WebP, quality 75)
  const thumbBuffer = await sharp(inputBuffer)
    .resize(400, 400, {
      fit: "inside",
      withoutEnlargement: true,
    })
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
