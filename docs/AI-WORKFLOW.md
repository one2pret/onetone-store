# 🤖 AI-Native Engineering Workflow — onetone-store
> Solo developer + AI = tim kecil yang bergerak cepat.
> Dokumen ini adalah panduan operasional harian kamu dengan Claude, Cline, dan Claude Code.

---

## Daftar Isi

1. [Gambaran Besar: 3 Layer AI Tools](#1-gambaran-besar)
2. [Setup Awal (Lakukan Sekali)](#2-setup-awal)
3. [Workflow Harian](#3-workflow-harian)
4. [Sprint Plan 30 Hari](#4-sprint-plan-30-hari)
5. [Cara Komunikasi Efektif dengan AI](#5-cara-komunikasi-efektif-dengan-ai)
6. [Storage Guide & Lanjutan R2](#6-storage-guide-lanjutan-r2)
7. [Claude Code: Kapan dan Cara Pakainya](#7-claude-code)
8. [Checklist Harian & Weekly Review](#8-checklist)

---

## 1. Gambaran Besar: 3 Layer AI Tools

```
┌────────────────────────────────────────────────────────────┐
│  LAYER 1 — STRATEGIST (claude.ai Pro)                      │
│  Untuk: planning, arsitektur, review logic, debug kompleks │
│  Kapan: awal sesi, saat stuck, review PR sendiri           │
│  File: attach CLAUDE.md + file relevan per sesi            │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  LAYER 2 — EXECUTOR (Cline di VSCode)                      │
│  Untuk: nulis kode, edit file, generate boilerplate        │
│  Kapan: setelah plan jelas, eksekusi fitur per fitur       │
│  Model: claude-sonnet-4-6 via Anthropic API (pay-per-use)  │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  LAYER 3 — AGENT (Claude Code CLI) ← opsional, powerful    │
│  Untuk: task besar multi-file, refactor, generate test     │
│  Kapan: saat butuh AI yang "jalan sendiri" di codebase     │
│  Install: curl -fsSL https://claude.ai/install.sh | bash   │
└────────────────────────────────────────────────────────────┘
```

**Biaya estimasi per bulan:**
- Claude Pro: $20 (claude.ai untuk planning & review)
- Cline API usage: ~$5–15 (tergantung seberapa banyak generate)
- Claude Code: termasuk di Claude Pro subscription
- **Total: ~$25–35/bulan ≈ Rp 400–560rb**

---

## 2. Setup Awal (Lakukan Sekali)

### 2.1 VSCode Extensions Wajib

```bash
# Install via VSCode Extensions panel atau CLI:
code --install-extension saoudrizwan.claude-dev          # Cline
code --install-extension bradlc.vscode-tailwindcss       # Tailwind IntelliSense
code --install-extension dbaeumer.vscode-eslint          # ESLint
code --install-extension esbenp.prettier-vscode          # Prettier
code --install-extension drizzle-team.drizzle-vscode     # Drizzle ORM
```

### 2.2 Setup Cline

1. Buka VSCode → Extensions → Cline → Settings
2. API Provider: **Anthropic**
3. API Key: isi dari https://console.anthropic.com/
4. Model: `claude-sonnet-4-6` (terbaik untuk coding, hemat vs Opus)
5. Auto-approve: **OFF** dulu — review setiap perubahan file sampai kamu nyaman

### 2.3 Install Claude Code CLI (macOS)

```bash
# Install
curl -fsSL https://claude.ai/install.sh | bash

# Login (pakai akun Claude Pro yang sama)
claude login

# Cek versi
claude --version

# Jalankan di folder project
cd ~/Projects/onetone-store
claude
```

### 2.4 Update CLAUDE.md (kamu sudah punya, tambahkan ini)

Tambahkan section berikut ke `CLAUDE.md` existing kamu:

```markdown
## Storage Strategy

- Image storage: Cloudflare R2 (BUKAN folder /public)
- Storage abstraction: `lib/storage.ts` — semua upload/delete/getUrl lewat sini
- Image processing: `sharp` — resize 800px, convert WebP, simpan original
- DB simpan: `object_key` saja (bukan full URL)
- CDN base: `NEXT_PUBLIC_CDN_URL` dari env
- Bucket structure: `/{store-id}/products/{product-id}/{uuid}.webp`

## AI Workflow

- Planning & review: Claude.ai Pro (claude.ai)
- Code generation: Cline di VSCode (Anthropic API)
- Agentic tasks: Claude Code CLI (`claude` command)
- Setiap sesi Cline: attach CLAUDE.md sebagai context
- Commit per fitur selesai, bukan per session

## Current Sprint Focus

- [ ] Storage layer (lib/storage.ts + R2 setup)
- [ ] Image upload di admin produk
- [ ] Google Drive import (lib/drive-import.ts)
- [ ] Flutter app skeleton + auth
```

---

## 3. Workflow Harian

### Pagi (15 menit — Planning)

```
1. Buka claude.ai
2. Buka percakapan baru
3. Upload/paste CLAUDE.md ke context
4. Ketik: "Hari ini saya mau kerjakan [FITUR X].
   Berikan saya:
   - File mana yang perlu dibuat/diedit
   - Urutan kerja yang logis
   - Potensi masalah yang perlu diperhatikan"
5. Catat output ke notes/todo harian
```

### Siang (Coding Session dengan Cline)

```
1. Buka VSCode + Cline panel
2. Attach CLAUDE.md ke Cline context (ikon paperclip)
3. Mulai dari task terkecil yang atomic
4. Prompt Cline: "Buat [FUNGSI X] di [FILE Y] sesuai
   pattern yang sudah ada di project ini"
5. Review setiap perubahan sebelum approve
6. Commit setiap fitur kecil selesai: git commit -m "feat: ..."
```

### Malam (Review & Commit)

```
1. pnpm build — pastikan tidak ada error
2. Test manual fitur yang dibuat hari ini
3. git push
4. Update progress di CLAUDE.md (section Current Sprint)
5. Catat blocker/pertanyaan untuk esok pagi
```

---

## 4. Sprint Plan 30 Hari

### Minggu 1 (Hari 1–7): Storage + Image System

**Hari 1–2: Setup Cloudflare R2**
```
Task:
- Buat akun Cloudflare, enable R2
- Install: pnpm add @aws-sdk/client-s3 @aws-sdk/lib-storage sharp
- Buat lib/storage.ts (abstraction layer)
- Update .env.local dengan R2 credentials
- Test: upload file via script sederhana

Prompt Cline:
"Buat lib/storage.ts dengan interface StorageService yang punya
method: uploadFile, deleteFile, getPublicUrl. Implementasikan
dengan Cloudflare R2 menggunakan @aws-sdk/client-s3.
Ikuti pattern yang ada di lib/xendit.ts sebagai referensi style."
```

**Hari 3–4: Image Processing Pipeline**
```
Task:
- Buat lib/image-processor.ts (sharp wrapper)
- Fungsi: processProductImage(buffer) → { original, webp, thumb }
- Integrasi ke admin upload form produk
- Test: upload foto, cek R2 bucket, cek URL

Prompt Cline:
"Buat lib/image-processor.ts menggunakan sharp.
Input: Buffer dari upload. Output: { original: Buffer,
webp: Buffer (800px max, quality 80), thumb: Buffer (400px) }.
Semua output dalam format WebP."
```

**Hari 5–6: Product Images Schema & UI**
```
Task:
- Tambah tabel product_images ke lib/db/schema.ts
- Update form admin produk dengan image upload
- Tampilkan gambar di product list & detail
- pnpm db:push

Schema yang perlu ditambah:
  product_images: id, product_id, object_key, filename_original,
  mime, width, height, filesize, sort_order, is_primary, created_at
```

**Hari 7: Google Drive Import**
```
Task:
- Setup Google Cloud Console: enable Drive API + Picker API
- Buat lib/drive-import.ts
- Tambah tombol "Import dari Drive" di form produk
- Test flow: pilih foto di Drive → proses → simpan ke R2

Prompt Cline:
"Buat lib/drive-import.ts dengan fungsi downloadFromDrive(fileId, accessToken).
Download file dari Google Drive API, return sebagai Buffer.
Jangan simpan ke disk — stream langsung ke memori."
```

---

### Minggu 2 (Hari 8–14): Complete Backend + API Polish

**Hari 8–9: API Routes Audit**
```
Cek semua 13+ endpoint di app/api/ sudah berjalan:
- Test dengan curl atau Postman setiap endpoint
- Fix response format yang belum konsisten
- Tambah proper error handling

Prompt Claude.ai:
"Review app/api/ folder structure saya [paste struktur].
Endpoint mana yang kemungkinan belum complete atau
punya edge case yang belum di-handle?"
```

**Hari 10–11: Webhook Hardening**
```
Task:
- Test Xendit webhook dengan ngrok
- Test Bitship webhook
- Tambah logging yang proper
- Pastikan idempotency check berjalan

Prompt Cline:
"Tambahkan webhook_logs tabel di schema untuk menyimpan
setiap incoming webhook payload + response status.
Ini untuk debugging production nanti."
```

**Hari 12–13: Cron + Order Expiry**
```
Task:
- Test endpoint /api/cron/check-expired-orders
- Setup cron job (bisa pakai GitHub Actions gratis)
- Verifikasi stock restore berjalan saat expiry

GitHub Actions cron (buat .github/workflows/cron.yml):
  schedule: cron('*/10 * * * *')
  → curl ke endpoint cron dengan secret
```

**Hari 14: Testing Sprint 1**
```
Task:
- pnpm test — pastikan semua existing tests pass
- Tambah test untuk storage.ts
- Tambah test untuk image-processor.ts
- Fix breaking tests jika ada
```

---

### Minggu 3 (Hari 15–21): Flutter App

**Hari 15–16: Flutter Project Setup**
```
Task:
- flutter create onetone_app (di folder terpisah atau monorepo)
- Setup dependencies: dio, riverpod/provider, go_router
- Buat lib/api/api_client.dart (HTTP client wrapper)
- Buat lib/api/auth_api.dart (login, register, me)
- Test: login dari Flutter → dapat token

Prompt Cline (di folder Flutter):
"Buat api_client.dart menggunakan Dio dengan:
- Base URL dari env/config
- Bearer token interceptor (simpan token di SharedPreferences)
- Error handling interceptor (401 → logout, 5xx → show error)
- Response wrapper: { success: bool, data: T, error: String? }"
```

**Hari 17–18: Auth Flow Flutter**
```
Screens:
- SplashScreen (cek token → route ke home atau login)
- LoginScreen (email + password → POST /api/auth/login)
- RegisterScreen

State management: Riverpod atau Provider (pilih satu, konsisten)

Prompt Cline:
"Buat auth flow Flutter dengan Riverpod.
AuthNotifier dengan state: loading, authenticated, unauthenticated.
Simpan token di SharedPreferences.
Setelah login sukses, navigate ke HomeScreen."
```

**Hari 19–20: Product Catalog Flutter**
```
Screens:
- HomeScreen (banner + featured products)
- ProductListScreen (dengan search + filter kategori)
- ProductDetailScreen

API calls:
- GET /api/banners
- GET /api/products?featured=true
- GET /api/products?category=X&search=Y
- GET /api/products/[id]

Prompt Cline:
"Buat ProductCard widget yang reusable.
Tampilkan: gambar (CachedNetworkImage), nama, harga (format Rupiah),
badge stok jika stok < 5. Responsive grid 2 kolom."
```

**Hari 21: Cart Flutter**
```
Screens:
- CartScreen (list items + hapus + update qty)
- CartIcon di AppBar dengan badge count

API: GET/POST/PUT/DELETE /api/cart
```

---

### Minggu 4 (Hari 22–28): Checkout + Deploy

**Hari 22–23: Checkout Flutter**
```
Screens:
- AddressPickScreen (list + tambah alamat)
- ShippingRateScreen (pilih kurir dari /api/shipping/rates)
- ReviewOrderScreen (summary sebelum bayar)
- Setelah create order → buka invoice URL di WebView atau browser

API: POST /api/orders → { paymentUrl }
Package: url_launcher untuk buka Xendit URL
```

**Hari 24–25: Order History Flutter**
```
Screens:
- OrderListScreen (status chip per order)
- OrderDetailScreen (timeline status + items)
- TrackingScreen

API: GET /api/orders, GET /api/orders/[id]
```

**Hari 26–27: Deploy Backend**
```
Task:
- Setup VPS Ubuntu (Niagahoster/DigitalOcean)
- Install Node 20, MySQL, Nginx, PM2
- Clone repo, setup .env production
- pnpm build && pm2 start
- Setup SSL dengan Certbot
- Update webhook URL di Xendit & Bitship dashboard
- Test semua endpoint dari Postman dengan URL production

Pakai docs/DEPLOY-VPS-UBUNTU.md yang sudah ada di repo
```

**Hari 28: Flutter Build & Test**
```
Task:
- Update base URL ke production di Flutter config
- Test full flow: login → browse → cart → checkout → bayar
- Test di device fisik (bukan emulator saja)
- Build APK untuk testing: flutter build apk --debug
```

---

### Hari 29–30: Buffer + Handover

```
Hari 29: Fix bugs dari testing hari 28
Hari 30:
- Dokumentasi untuk klien (cara login admin, cara kelola produk)
- Backup database
- Setup monitoring sederhana (UptimeRobot gratis)
- Handover: credentials, repo access, panduan dasar
```

---

## 5. Cara Komunikasi Efektif dengan AI

### Pattern Prompt yang Terbukti Efektif

**Untuk fitur baru:**
```
"Di project onetone-store (Next.js 16 + Drizzle + TypeScript):
Buat [NAMA FITUR].

Konteks:
- File yang relevan: [sebutkan file]
- Pattern yang sudah ada: [contoh file serupa]
- Constraint: [batasan teknis]

Output yang diharapkan:
- File baru: [nama file]
- Update file: [nama file]
- Jangan ubah: [file yang tidak boleh diubah]"
```

**Untuk debug:**
```
"Error ini muncul di [file/context]:
[paste error message]

Relevant code:
[paste 20-30 baris kode sekitar error]

Yang sudah saya coba: [list hal yang sudah dicoba]
Tolong diagnosis dan berikan fix."
```

**Untuk review:**
```
"Review [file ini]:
[paste kode]

Fokus pada:
1. Security issues
2. Edge cases yang belum di-handle
3. Konsistensi dengan pattern project (lihat CLAUDE.md)
4. Performance concerns"
```

### Aturan Vibe Coding yang Aman

1. **Satu fitur, satu sesi** — jangan campur 3 fitur dalam satu prompt
2. **Review sebelum commit** — jangan auto-accept semua suggestion
3. **Business logic = tanggung jawab kamu** — AI bisa salah logika order/stock
4. **Test setelah setiap fitur** — jangan tumpuk 5 fitur tanpa test
5. **Commit sering** — kalau AI bikin mess, mudah revert

---

## 6. Storage Guide Lanjutan R2

### File yang Perlu Dibuat

```
lib/
  storage.ts          ← abstraction layer (WAJIB PERTAMA)
  image-processor.ts  ← sharp wrapper
  drive-import.ts     ← Google Drive integration
```

### lib/storage.ts — Skeleton

```typescript
// lib/storage.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const storage = {
  async upload(key: string, body: Buffer, contentType: string) {
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return { key, url: this.getUrl(key) };
  },

  async delete(key: string) {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    }));
  },

  getUrl(key: string): string {
    return `${process.env.NEXT_PUBLIC_CDN_URL}/${key}`;
  },
};
```

### Env Variables yang Perlu Ditambah

```bash
# .env.local
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=onetone-store
NEXT_PUBLIC_CDN_URL=https://cdn.yourdomain.com  # atau R2 public URL
```

### Schema Database — Tambahkan di lib/db/schema.ts

```typescript
export const productImages = mysqlTable("product_images", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("product_id").references(() => products.id).notNull(),
  objectKey: varchar("object_key", { length: 500 }).notNull(),
  filenameOriginal: varchar("filename_original", { length: 255 }),
  mime: varchar("mime", { length: 100 }).default("image/webp"),
  width: int("width"),
  height: int("height"),
  filesize: int("filesize"),
  sortOrder: int("sort_order").default(0),
  isPrimary: boolean("is_primary").default(false),
  checksum: varchar("checksum", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 7. Claude Code: Kapan dan Cara Pakainya

Claude Code adalah CLI agent yang bisa membaca & menulis seluruh codebase secara otonom. Ini beda dari Cline — lebih powerful untuk task besar.

### Install (macOS)

```bash
curl -fsSL https://claude.ai/install.sh | bash
claude login  # pakai akun Claude Pro
```

### Kapan Pakai Claude Code vs Cline

| Situasi | Gunakan |
|---------|---------|
| Buat satu file/function | Cline |
| Refactor seluruh folder | Claude Code |
| Generate semua test sekaligus | Claude Code |
| Debug satu error | Cline atau claude.ai |
| Migrasi schema + update semua query | Claude Code |
| Buat Flutter screen baru | Cline |

### Cara Pakai Efektif

```bash
# Mulai sesi di folder project
cd ~/Projects/onetone-store
claude

# Contoh perintah efektif:
"Generate unit tests untuk semua fungsi di lib/storage.ts dan lib/image-processor.ts"

"Refactor semua API routes di app/api/ agar response format konsisten: { success, data, error }"

"Buat migration untuk menambahkan tabel product_images ke schema Drizzle dan update semua relasi yang relevan"
```

### Tips Claude Code

- CLAUDE.md di root project otomatis terbaca sebagai context
- Selalu review perubahan sebelum confirm (`y/n` prompt)
- Untuk task besar, pecah jadi beberapa sesi
- Gunakan `/clear` untuk reset context jika sesi terlalu panjang

---

## 8. Checklist Harian & Weekly Review

### Checklist Harian ✓

```
[ ] pnpm dev → tidak ada error di terminal
[ ] Fitur hari ini: sudah test manual
[ ] git commit dengan pesan yang jelas
[ ] CLAUDE.md updated (jika ada perubahan arsitektur)
[ ] .env.example updated (jika ada env baru)
```

### Weekly Review (setiap Jumat)

```
[ ] pnpm build → sukses
[ ] pnpm test → semua pass
[ ] git push ke main
[ ] Review open issues di GitHub
[ ] Update progress di bagian ini:

## Progress Log

### Minggu 1
- [x] Setup project (sesi 01-03)
- [ ] Storage layer R2
- [ ] Image processing
- [ ] Google Drive import

### Minggu 2
- [ ] API audit & polish
- [ ] Webhook hardening
- [ ] Testing

### Minggu 3
- [ ] Flutter setup + auth
- [ ] Product catalog
- [ ] Cart

### Minggu 4
- [ ] Checkout + order
- [ ] Deploy VPS
- [ ] Handover klien
```

---

## Referensi Cepat

| Kebutuhan | Tool | Command/URL |
|-----------|------|-------------|
| Planning sesi | claude.ai | claude.ai/new |
| Generate kode | Cline VSCode | Ctrl+Shift+P → Cline |
| Agentic task | Claude Code | `claude` di terminal |
| Drizzle Studio | Drizzle | `pnpm db:studio` |
| Dev server | Next.js | `pnpm dev` |
| Test | Vitest | `pnpm test` |
| R2 Dashboard | Cloudflare | dash.cloudflare.com |
| Xendit Sandbox | Xendit | dashboard.xendit.co |
| Bitship Test | Bitship | biteship.com/dashboard |

---

*Dokumen ini hidup — update setiap kali ada perubahan strategi atau selesai milestone.*
*Last updated: Juli 2026*
