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

export async function downloadFromDrive(
  fileId: string,
  accessToken: string
): Promise<DownloadedFile> {
  const meta = await getDriveFileMeta(fileId, accessToken);

  if (!ALLOWED_MIME.includes(meta.mimeType)) {
    throw new Error(
      `Tipe file "${meta.mimeType}" tidak didukung. Gunakan JPEG, PNG, WebP, atau HEIC.`
    );
  }

  if (meta.sizeBytes > MAX_FILE_SIZE) {
    throw new Error(`File "${meta.name}" melebihi batas 15MB.`);
  }

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
