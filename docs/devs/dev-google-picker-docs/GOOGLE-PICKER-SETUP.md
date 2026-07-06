# Google Drive Picker — Setup & Implementasi
> Import foto produk langsung dari Google Drive ke onetone-store
> Reuse pipeline storage yang sudah jalan (storage.ts + image-processor.ts + R2)

---

## Gambaran Alur

```
Admin klik "Import dari Drive"
   ↓
Google Picker popup (pilih foto, bisa multi-select)
   ↓
Client dapat access_token + file IDs
   ↓
Server action: download dari Drive → sharp WebP → upload R2 → simpan DB
   ↓
Foto muncul di galeri produk (skip duplikat via checksum)
```

---

## BAGIAN 1 — Setup Google Cloud Console (sekali saja, ~15 menit)

### 1.1 Buat / pilih project
1. Buka https://console.cloud.google.com
2. Pilih project atau buat baru: "onetone-store"

### 1.2 Enable API
1. Menu → APIs & Services → Library
2. Cari & enable: **Google Picker API**
3. Cari & enable: **Google Drive API**

### 1.3 Buat API Key (untuk Picker)
1. APIs & Services → Credentials → Create Credentials → API Key
2. Copy API key → ini jadi `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`
3. (Opsional tapi disarankan) Klik key → Application restrictions:
   - HTTP referrers → tambah: `http://localhost:3000/*` dan domain production
   - API restrictions → pilih: Google Picker API + Google Drive API

### 1.4 Buat OAuth Client ID (untuk akses token)
1. Credentials → Create Credentials → OAuth client ID
2. Kalau diminta, setup OAuth consent screen dulu:
   - User type: External
   - App name: onetone-store
   - Scopes: tambah `.../auth/drive.readonly`
   - Test users: tambah email kamu + email klien (saat masih mode testing)
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://your-domain.com` (production nanti)
5. Create → copy Client ID → ini jadi `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

---

## BAGIAN 2 — Environment Variables

Tambahkan ke `.env.local`:

```bash
# Google Drive Picker
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=AIzaSyXXXXX
```

Update juga `.env.example` (tanpa value asli):

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=
```

---

## BAGIAN 3 — File yang Dibuat

```
lib/drive-import.ts                       ← download helper dari Drive API
app/actions/drive-import.ts               ← server action import → R2 → DB
components/admin/GoogleDrivePicker.tsx     ← tombol + Picker popup
```

Ketiganya sudah disediakan lengkap. Copy ke path masing-masing.

---

## BAGIAN 4 — Integrasi ke Halaman Edit Produk

Di `app/(admin)/dashboard/products/[id]/edit/page.tsx`, tambahkan tombol Picker
di dekat `ProductImageUploader`:

```tsx
import { GoogleDrivePicker } from "@/components/admin/GoogleDrivePicker";

// Di dalam JSX, section foto produk:
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold">Foto Produk</h2>
    <GoogleDrivePicker productId={Number(id)} />
  </div>
  <ProductImageUploader productId={Number(id)} initialImages={images} />
</div>
```

> Catatan: kalau mau galeri auto-refresh setelah import tanpa reload,
> ubah `ProductImageUploader` agar state gambar diangkat ke parent,
> lalu oper `onImported` ke `GoogleDrivePicker`. Untuk MVP, reload page cukup.

---

## BAGIAN 5 — Testing

### 5.1 Test manual
1. `pnpm dev`
2. Login admin → buka edit produk
3. Klik "Import dari Google Drive"
4. Popup Google muncul → pilih akun → izinkan akses
5. Picker muncul → pilih 1-3 foto → klik "Select"
6. Toast "Mengimport..." → lalu "N foto berhasil diimport"
7. Cek galeri produk → foto muncul
8. Cek R2 bucket → file WebP baru ada di products/{slug}/
9. Cek Drizzle Studio → row baru di product_images

### 5.2 Test duplikat
1. Import foto yang sama dua kali
2. Yang kedua harus di-skip (toast: "duplikat, dilewati")
3. Tidak ada row dobel di DB

### 5.3 Verifikasi akhir
- [ ] pnpm build → 0 error
- [ ] Import 1 foto berhasil
- [ ] Import multi foto (3+) berhasil
- [ ] Duplikat ter-skip
- [ ] Foto pertama otomatis jadi primary

---

## Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Popup "Access blocked" | OAuth consent screen belum publish / email bukan test user | Tambah email ke Test users di consent screen |
| "idpiframe_initialization_failed" | Origin tidak terdaftar | Tambah localhost:3000 ke Authorized JS origins |
| Picker tidak muncul | API key salah / Picker API belum enable | Cek NEXT_PUBLIC_GOOGLE_PICKER_API_KEY + enable Picker API |
| 403 saat download | Scope kurang | Pastikan scope drive.readonly di token client |
| Foto tidak masuk R2 | storage.ts belum jalan | Test upload manual dulu, pastikan R2 env benar |
| Token expired | Access token Picker short-lived | Normal — token dipakai langsung saat import, tidak disimpan |
| "Missing required parameter client_id" | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` belum ada di `.env.local` | Tambah variabel ke `.env.local`, restart dev server |
| Error 401: invalid_client — "The OAuth client was not found" | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` diisi dengan Client **Secret** bukan Client **ID** | Ambil nilai yang berakhiran `.apps.googleusercontent.com`, bukan `GOCSPX-...` |
| Error 401: invalid_client — setelah Client ID benar | `http://localhost:3000` belum terdaftar di Authorized JavaScript Origins | Google Cloud Console → Credentials → edit OAuth Client → tambah `http://localhost:3000` di Authorized JS Origins → tunggu 5–10 menit |
| Foto masuk R2 tapi tampil **blank putih** di admin/customer | `next/image` optimizer gagal fetch dari R2 CDN (server-side fetch) | Tambah `unoptimized` prop di semua `<Image>` yang menampilkan gambar R2 (lihat bagian di bawah) |
| Foto di product list (dashboard) tetap kosong setelah import Drive | `products.image` tidak diupdate karena `syncProductPrimaryImage` tidak dipanggil di drive-import | Bug sudah diperbaiki di `app/actions/drive-import.ts` — pastikan pakai versi terbaru |
| Galeri tidak refresh otomatis setelah import Drive | `router.refresh()` tidak dipanggil setelah import sukses | Bug sudah diperbaiki di `GoogleDrivePicker.tsx` — pastikan pakai versi terbaru |

### Cara membedakan Client ID vs Client Secret

```
Client ID     → 123456789012-abcdefgh.apps.googleusercontent.com   ✅ ini yang dipakai
Client Secret → GOCSPX-xxxxxxxxxxxxxxxxxxxxxx                       ❌ jangan dipakai
```

Keduanya ada di halaman edit OAuth Client di Google Cloud Console.
Pastikan copy dari kolom **"Your Client ID"**, bukan **"Your Client Secret"**.

### Checklist kalau masih Error 401

1. [ ] Client ID format berakhiran `.apps.googleusercontent.com`
2. [ ] Application type OAuth Client = **Web application** (bukan Desktop/Android)
3. [ ] `http://localhost:3000` ada di **Authorized JavaScript origins**
4. [ ] Email kamu ada di **Test users** (jika consent screen masih mode Testing)
5. [ ] Sudah tunggu 5–10 menit setelah simpan perubahan di Google Console
6. [ ] Dev server sudah di-restart setelah update `.env.local`

### Kenapa gambar R2 harus pakai `unoptimized`

`next/image` secara default melakukan **server-side optimization**:
browser → Next.js server → fetch dari R2 → resize/convert → kirim ke browser.

Jika Next.js dev server tidak bisa fetch dari R2 CDN (network issue, CDN policy, dll),
gambar gagal tampil — ditampilkan sebagai blank putih tanpa error di browser.

Karena gambar di R2 **sudah diproses sharp** (sudah WebP, sudah ukuran benar),
optimizer tidak dibutuhkan. Solusinya: tambah prop `unoptimized` agar browser
load langsung dari CDN tanpa lewat Next.js.

```tsx
// Semua <Image> yang src-nya dari R2 CDN:
<Image src={url} alt="..." fill unoptimized className="object-cover" />
```

File yang sudah diperbaiki:
- `components/admin/ProductImageUploader.tsx` — galeri gambar di edit produk
- `components/shop/ProductGallery.tsx` — galeri di halaman produk customer
- `components/shop/ProductCard.tsx` — thumbnail di listing produk
- `app/(admin)/dashboard/products/_components/ProductsTable.tsx` — thumbnail di tabel admin

---

## Catatan Keamanan

- Access token dari Picker **short-lived** dan **tidak disimpan** di DB/server —
  hanya dipakai sekali saat import berlangsung.
- Scope `drive.readonly` = hanya baca, tidak bisa ubah/hapus Drive user.
- Untuk multi-tenant (UMKM lain) nanti: setiap tenant OAuth dengan akun Drive
  mereka sendiri — tidak ada akses silang.
