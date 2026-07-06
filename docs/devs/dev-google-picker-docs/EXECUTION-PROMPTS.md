# Execution Prompts — Google Drive Picker
> Prompt siap-pakai untuk Claude Code CLI, Cline, atau AI apapun (Gemini/DeepSeek/GPT).
> Copy-paste sesuai tool yang kamu pakai.

---

## CARA PAKAI DOKUMEN INI

- **Claude Code CLI**: jalankan `claude` di root project, paste PROMPT A.
- **Cline (VSCode)**: buka Cline, attach CLAUDE.md, paste PROMPT per-file.
- **AI lain (Gemini/DeepSeek via Cline)**: sama, tapi lebih baik per-file (PROMPT B1-B3)
  karena model non-Claude kadang kurang presisi untuk multi-file sekaligus.

---

## PROMPT A — Untuk Claude Code CLI (multi-file sekaligus)

```
Aku mau menambahkan fitur "Import foto produk dari Google Drive" ke project ini.

Konteks project (baca CLAUDE.md untuk detail lengkap):
- Next.js 16, TypeScript, Drizzle ORM, Server Actions
- Storage sudah jalan: lib/storage.ts (R2) + lib/image-processor.ts (sharp WebP)
- Tabel product_images sudah ada
- Middleware bernama proxy.ts (bukan middleware.ts)

Buat 3 file berikut (kode lengkap sudah aku siapkan, minta aku paste kalau perlu,
atau generate sesuai spesifikasi ini):

1. lib/drive-import.ts
   - getDriveFileMeta(fileId, accessToken): ambil metadata via Drive API v3
   - downloadFromDrive(fileId, accessToken): download 1 file sebagai Buffer,
     validasi MIME (jpeg/png/webp/heic) + ukuran max 15MB
   - downloadBatchFromDrive(fileIds, accessToken, concurrency=3): batch download
     dengan konkurensi terbatas

2. app/actions/drive-import.ts (server action "use server")
   - importFromDrive(productId, fileIds, accessToken)
   - Auth check admin
   - Download batch dari Drive → processProductImage (sharp) → storage.upload (R2)
   - Skip duplikat via checksum (bandingkan dengan existing product_images)
   - Insert ke product_images, foto pertama jadi isPrimary
   - revalidatePath setelah selesai

3. components/admin/GoogleDrivePicker.tsx (client component)
   - Tombol "Import dari Google Drive"
   - Load gapi + Google Identity Services
   - Buka Google Picker (DocsView images, multiselect)
   - Ambil access_token via initTokenClient, scope drive.readonly
   - Kirim fileIds + token ke importFromDrive server action
   - Toast feedback (pakai sonner yang sudah ada di project)

Env yang dibutuhkan (tambahkan ke .env.example juga):
  NEXT_PUBLIC_GOOGLE_CLIENT_ID
  NEXT_PUBLIC_GOOGLE_PICKER_API_KEY

Ikuti style & pattern yang sudah ada di project (lihat lib/storage.ts sebagai referensi).
Setelah selesai, jalankan pnpm build untuk pastikan tidak ada type error.
```

---

## PROMPT B1 — Cline: buat lib/drive-import.ts

```
Buat file lib/drive-import.ts di project onetone-store (Next.js 16 + TypeScript).

Fungsi yang dibutuhkan:
1. getDriveFileMeta(fileId: string, accessToken: string): Promise<DriveFileMeta>
   - Fetch ke https://www.googleapis.com/drive/v3/files/{fileId}?fields=id,name,mimeType,size
   - Header Authorization: Bearer {accessToken}
   - Return { id, name, mimeType, sizeBytes }

2. downloadFromDrive(fileId, accessToken): Promise<DownloadedFile>
   - Ambil metadata dulu, validasi MIME (jpeg/png/webp/heic/heif) + max 15MB
   - Fetch ke .../files/{fileId}?alt=media untuk download binary
   - Return { buffer: Buffer, filename, mimeType }

3. downloadBatchFromDrive(fileIds, accessToken, concurrency=3)
   - Proses fileIds dalam batch sesuai concurrency (Promise.all per chunk)
   - Return array { fileId, result, error }

Semua fetch pakai native fetch. Buffer dari arrayBuffer. Jangan simpan ke disk.
Export semua type (DriveFileMeta, DownloadedFile).
```

## PROMPT B2 — Cline: buat app/actions/drive-import.ts

```
Buat server action app/actions/drive-import.ts (dengan "use server" di baris atas).

Import dari project yang sudah ada:
- auth dari @/lib/auth
- db dari @/lib/db
- products, productImages dari @/lib/db/schema
- storage, generateObjectKey dari @/lib/storage
- processProductImage dari @/lib/image-processor
- downloadBatchFromDrive dari @/lib/drive-import
- eq dari drizzle-orm
- revalidatePath dari next/cache

Fungsi importFromDrive(productId: number, fileIds: string[], accessToken: string):
1. Auth check — hanya admin (session.user.role === "admin")
2. Pastikan produk ada (query products by id)
3. downloadBatchFromDrive(fileIds, accessToken, 3)
4. Ambil existing product_images untuk cek checksum duplikat & hitung sortOrder
5. Untuk tiap file berhasil download:
   - processProductImage(buffer) → main/thumb/original
   - storage.upload main, cek checksum → skip kalau duplikat (hapus yg terlanjur upload)
   - upload thumb + original
   - insert ke product_images (foto pertama isPrimary=true)
6. revalidatePath("/dashboard/products/{id}/edit") dan "/dashboard/products"
7. Return { success, imported, failed, errors[] }

Ikuti pattern server action yang sudah ada di app/actions/product-images.ts
```

## PROMPT B3 — Cline: buat components/admin/GoogleDrivePicker.tsx

```
Buat client component components/admin/GoogleDrivePicker.tsx ("use client").

Props: { productId: number, onImported?: () => void }

Fungsi:
1. openPicker(): load script apis.google.com/js/api.js + accounts.google.com/gsi/client
2. gapi.load("picker"), lalu google.accounts.oauth2.initTokenClient
   - client_id dari NEXT_PUBLIC_GOOGLE_CLIENT_ID
   - scope "https://www.googleapis.com/auth/drive.readonly"
   - callback → buildPicker(access_token)
3. buildPicker: PickerBuilder dengan DocsView(DOCS_IMAGES), MULTISELECT_ENABLED,
   setDeveloperKey(NEXT_PUBLIC_GOOGLE_PICKER_API_KEY), setOAuthToken(token)
4. Callback picker: kalau action PICKED, ambil array file ID dari documents,
   panggil importFromDrive(productId, fileIds, token) via useTransition
5. Toast feedback pakai sonner

Render: tombol dengan ikon Google Drive + label "Import dari Google Drive",
disabled saat loading. Style Tailwind konsisten dengan tombol lain di project.

declare global untuk window.gapi dan window.google (any).
```

---

## PROMPT C — Untuk buat GitHub Issue (via Perplexity)

```
Buat GitHub issue untuk repo one2pret/onetone-store dengan judul:
"feat: Google Drive import untuk foto produk"

Body:
## Tujuan
Admin bisa import foto produk langsung dari Google Drive (multi-select)
tanpa download-upload manual.

## Acceptance Criteria
- [ ] lib/drive-import.ts: download helper dari Drive API
- [ ] app/actions/drive-import.ts: server action import → R2 → product_images
- [ ] components/admin/GoogleDrivePicker.tsx: tombol + Picker popup
- [ ] Multi-select support
- [ ] Skip duplikat via checksum
- [ ] Foto pertama auto jadi primary
- [ ] Env: NEXT_PUBLIC_GOOGLE_CLIENT_ID + NEXT_PUBLIC_GOOGLE_PICKER_API_KEY
- [ ] pnpm build passing

## Referensi
Reuse pipeline storage yang sudah ada (lib/storage.ts + lib/image-processor.ts).
Google Picker API + Drive API v3.

Label: enhancement, storage
Branch: feat/google-drive-import
```

---

## Verifikasi Setelah Eksekusi

Jalankan checklist ini apapun tool yang dipakai:

```bash
# 1. Type check
pnpm build

# 2. Cek file ada
ls lib/drive-import.ts
ls app/actions/drive-import.ts
ls components/admin/GoogleDrivePicker.tsx

# 3. Cek env
grep GOOGLE .env.local

# 4. Test dev
pnpm dev
# → login admin → edit produk → Import dari Drive → pilih foto → cek galeri
```
