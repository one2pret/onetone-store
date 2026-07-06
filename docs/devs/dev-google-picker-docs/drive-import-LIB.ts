// lib/drive-import.ts
// Google Drive import helper — download file dari Drive API menggunakan access token
// Dipakai bersama Google Picker (client memilih file, server download & proses)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DownloadedFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

// ─── Konstanta ────────────────────────────────────────────────────────────────

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// ─── Get metadata file ────────────────────────────────────────────────────────

/**
 * Ambil metadata file dari Drive (nama, mime, ukuran) sebelum download.
 * @param fileId      ID file dari Google Picker
 * @param accessToken OAuth access token (dari client, scope drive.readonly / drive.file)
 */
export async function getDriveFileMeta(
  fileId: string,
  accessToken: string
): Promise<DriveFileMeta> {
  const res = await fetch(
    `${DRIVE_API}/files/${fileId}?fields=id,name,mimeType,size`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gagal ambil metadata Drive (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    sizeBytes: data.size ? Number(data.size) : 0,
  };
}

// ─── Download file ────────────────────────────────────────────────────────────

/**
 * Download file dari Google Drive sebagai Buffer.
 * Stream langsung ke memori — TIDAK simpan ke disk.
 *
 * @param fileId      ID file dari Google Picker
 * @param accessToken OAuth access token
 */
export async function downloadFromDrive(
  fileId: string,
  accessToken: string
): Promise<DownloadedFile> {
  // 1. Ambil metadata dulu untuk validasi
  const meta = await getDriveFileMeta(fileId, accessToken);

  // 2. Validasi MIME
  if (!ALLOWED_MIME.includes(meta.mimeType)) {
    throw new Error(
      `Tipe file "${meta.mimeType}" tidak didukung. Gunakan JPEG, PNG, WebP, atau HEIC.`
    );
  }

  // 3. Validasi ukuran
  if (meta.sizeBytes > MAX_FILE_SIZE) {
    throw new Error(`File "${meta.name}" melebihi batas 15MB.`);
  }

  // 4. Download konten (alt=media = ambil file binary)
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gagal download file Drive (${res.status}): ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    filename: meta.name,
    mimeType: meta.mimeType,
  };
}

// ─── Batch download (untuk multi-select Picker) ───────────────────────────────

/**
 * Download beberapa file sekaligus dengan konkurensi terbatas.
 * Proses N file paralel, sisanya antri — cegah memory spike.
 *
 * @param fileIds     Array ID file dari Picker
 * @param accessToken OAuth access token
 * @param concurrency Berapa file diproses paralel (default 3)
 */
export async function downloadBatchFromDrive(
  fileIds: string[],
  accessToken: string,
  concurrency: number = 3
): Promise<Array<{ fileId: string; result: DownloadedFile | null; error: string | null }>> {
  const results: Array<{
    fileId: string;
    result: DownloadedFile | null;
    error: string | null;
  }> = [];

  // Proses dalam batch sesuai concurrency
  for (let i = 0; i < fileIds.length; i += concurrency) {
    const chunk = fileIds.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (fileId) => {
        try {
          const result = await downloadFromDrive(fileId, accessToken);
          return { fileId, result, error: null };
        } catch (err) {
          const error = err instanceof Error ? err.message : "Download gagal";
          return { fileId, result: null, error };
        }
      })
    );
    results.push(...chunkResults);
  }

  return results;
}
