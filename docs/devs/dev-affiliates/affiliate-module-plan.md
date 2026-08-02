# Affiliate Module — Rencana Implementasi

> Lokasi file ini: `docs/devs/dev-affiliates/affiliate-module-plan.md`
> Status: **Draft v1 — menunggu keputusan owner pada §2** · divalidasi ulang 2026-08-02 (lihat catatan koreksi di §3.4, §4.1, §1)
> Konteks: onetone-store (Next.js 16 + Drizzle + MySQL 8), single-store, dua persona (Admin, Customer)
> Dependensi: tidak memblokir Phase 0 rebrand maupun POS module. Bisa jalan paralel.

---

## 1. Ringkasan

Sistem affiliate memungkinkan **member (customer terdaftar)** mempromosikan produk Onetone lewat link/kode referral unik, lalu mendapat komisi dari setiap pesanan yang selesai.

Model yang dipakai adalah model **Shopee Affiliate / Tokopedia Affiliate**, disederhanakan untuk single-store:

```
Member daftar affiliate  →  Admin approve  →  Dapat kode + link
       ↓
Share link produk (IG/TikTok/WA)
       ↓
Pengunjung klik → cookie attribution (30 hari)
       ↓
Checkout → order tercatat punya affiliate_id
       ↓
Order delivered → +hold period 7 hari (window retur)
       ↓
Komisi approved → masuk saldo affiliate
       ↓
Withdraw ke rekening (min. Rp50.000) → Xendit Disbursement
```

**Prinsip desain yang dipegang:**

1. **Additive-only pada tabel eksisting.** Kolom baru di `orders` semuanya nullable. Tidak ada perubahan destruktif pada `users`, `products`, `order_items`.
2. **Komisi adalah ledger, bukan angka yang di-update.** Saldo affiliate selalu hasil agregasi ledger — tidak pernah disimpan sebagai kolom yang di-`UPDATE` langsung. Ini mencegah saldo drift dan bikin audit gampang.
3. **Uang tidak pernah keluar tanpa order selesai.** Komisi baru bisa ditarik setelah order `delivered` + hold period lewat.
4. **Anti-fraud sejak MVP, bukan ditambal belakangan.** Self-referral, order cancel, dan refund harus punya jalur reversal dari hari pertama.
5. **Tidak melanggar brand.** Tidak ada badge neon "CUAN!!!" ala marketplace. Dashboard affiliate memakai bahasa yang sama dengan admin panel: tenang, angka jujur. Sistem warna aktif adalah **white-dark monokrom + micro-gold** (lihat `docs/design-system/01-color-tokens.md`) — primary adalah putih (`bg-primary`/`#FFFFFF`), gold `#C9A84C` **hanya** untuk badge tier/VIP/poin (~1-2% permukaan), bukan aksen umum. Tier affiliate (Starter/Silver/Gold) pas dipakein gold di badge tier-nya saja; tombol, link, CTA tetap putih.

---

## 2. Keputusan yang Perlu Owner Putuskan Dulu

Empat hal ini mengubah schema, jadi harus fix sebelum generate kode.

### 2.1 Single-tier atau multi-level?

| Opsi | Deskripsi | Rekomendasi |
|------|-----------|-------------|
| **A. Single-tier** | Affiliate dapat komisi hanya dari penjualan yang dia bawa | ✅ **Direkomendasikan** untuk MVP |
| B. Two-tier | Affiliate juga dapat % kecil dari affiliate yang dia rekrut | Bisa ditambah di P3, schema sudah disiapkan (`parent_affiliate_id`) |
| C. Multi-level (MLM) | 3+ level ke bawah | ❌ Hindari — masuk area regulasi PLB/skema piramida di Indonesia |

**Alasan memilih A:** Shopee & Tokopedia sendiri single-tier. Two-tier menaikkan risiko regulasi dan bikin perhitungan komisi jauh lebih rumit tanpa proporsi hasil yang sepadan di skala UMKM.

### 2.2 Besaran komisi

Default yang diusulkan:

| Level | Kriteria | Komisi |
|-------|----------|--------|
| Starter | Default saat approve | **5%** |
| Silver | GMV 30 hari ≥ Rp5.000.000 | **7%** |
| Gold | GMV 30 hari ≥ Rp15.000.000 | **10%** |

Plus override per-produk & per-kategori (misal produk clearance = 2%, produk baru = 12% untuk boost).

> ⚠️ **Tabrakan nama dengan `member_tiers`.** Tabel `member_tiers` (loyalty tier customer, Phase 1) sudah pakai nama **"Silver"** dan **"Gold"**. Satu user bisa jadi Member Gold *dan* Affiliate Gold sekaligus — dua hal berbeda, nama sama, berpotensi ambigu di UI/dukungan pelanggan ("Gold" yang mana?). Rekomendasi: pilih nama tier affiliate yang beda, misal **Starter / Pro / Elite**, sebelum schema di-generate.

**Basis perhitungan komisi:** `subtotal item` — **tidak termasuk** ongkir dan **setelah** dikurangi diskon/voucher. Ini penting, kalau tidak affiliate bisa "menambang" ongkir.

### 2.3 Cookie attribution window & model

- **Window: 30 hari** (Shopee 7 hari, Tokopedia 7 hari, Amazon 24 jam — 30 hari lebih generous, cocok untuk brand kecil yang butuh affiliate loyal)
- **Model: last-click wins** — kalau user klik link Affiliate A lalu Affiliate B, yang dapat komisi adalah B.
- **Trigger attribution:** order dibuat (bukan saat klik), disimpan permanen di `orders.affiliate_id`.

### 2.4 Pajak & withholding

Komisi affiliate = penghasilan. Untuk affiliate dengan NPWP, secara teknis kena **PPh 21 (bukan pegawai)** atau **PPh 23**. Opsi:

- **Opsi A (MVP):** Tidak ada withholding di sistem. Affiliate bertanggung jawab atas pajaknya sendiri, dinyatakan di Terms. Sistem menyediakan export rekap tahunan per affiliate.
- **Opsi B:** Sistem potong otomatis. Butuh field NPWP, logika tarif, dan bukti potong — kompleks.

**Rekomendasi: Opsi A untuk P1**, dengan kolom `npwp` sudah disiapkan di schema supaya bisa upgrade tanpa migrasi ulang. Ini bukan nasihat hukum — sebaiknya dikonfirmasi ke konsultan pajak sebelum volume komisi jadi signifikan.

---

## 3. Schema Database

### 3.1 Tabel baru

Semua ditambahkan di `lib/db/schema.ts`, mengikuti konvensi snake_case untuk nama tabel.

```typescript
// ============ AFFILIATES ============
export const affiliates = mysqlTable('affiliates', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').references(() => users.id).notNull().unique(),

  // Identitas publik
  code: varchar('code', { length: 32 }).notNull().unique(),   // "WAWAN23", dipakai di ?ref=
  displayName: varchar('display_name', { length: 255 }),

  status: mysqlEnum('affiliate_status', [
    'pending',    // sudah daftar, menunggu review admin
    'active',
    'suspended',  // dibekukan (indikasi fraud) — komisi ditahan
    'rejected',
  ]).default('pending').notNull(),

  tier: mysqlEnum('affiliate_tier', ['starter', 'silver', 'gold'])
    .default('starter').notNull(),

  // Data pendaftaran
  socialMedia: text('social_media'),        // JSON: {instagram, tiktok, youtube}
  audienceSize: int('audience_size'),
  motivation: text('motivation'),

  // Data payout
  bankCode: varchar('bank_code', { length: 20 }),        // kode bank Xendit: "BCA", "BNI"
  bankAccountNumber: varchar('bank_account_number', { length: 50 }),
  bankAccountName: varchar('bank_account_name', { length: 255 }),
  npwp: varchar('npwp', { length: 25 }),                 // disiapkan, belum dipakai di P1

  // Two-tier — disiapkan, tidak dipakai di P1
  parentAffiliateId: int('parent_affiliate_id'),

  approvedAt: timestamp('approved_at'),
  approvedBy: int('approved_by').references(() => users.id),
  suspendedAt: timestamp('suspended_at'),
  suspendReason: text('suspend_reason'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
```

> ⚠️ `parentAffiliateId` sengaja **tidak** diberi `.references()` untuk menghindari self-referencing FK yang bikin Drizzle circular. Integritas dijaga di application layer.

```typescript
// ============ AFFILIATE LINKS ============
// Link yang di-generate affiliate. Satu affiliate bisa punya banyak link
// (link toko umum, link per-produk, link per-kampanye).
export const affiliateLinks = mysqlTable('affiliate_links', {
  id: int('id').primaryKey().autoincrement(),
  affiliateId: int('affiliate_id').references(() => affiliates.id).notNull(),

  slug: varchar('slug', { length: 16 }).notNull().unique(),  // nanoid, untuk /r/{slug}
  targetType: mysqlEnum('target_type', ['home', 'product', 'category', 'custom'])
    .default('home').notNull(),
  targetId: int('target_id'),              // productId / categoryId
  targetPath: varchar('target_path', { length: 500 }),  // untuk custom, mis. "/products?category=sepatu"

  label: varchar('label', { length: 255 }),   // catatan affiliate: "IG Story Jan"
  utmSource: varchar('utm_source', { length: 100 }),
  utmMedium: varchar('utm_medium', { length: 100 }),
  utmCampaign: varchar('utm_campaign', { length: 100 }),

  clickCount: int('click_count').default(0).notNull(),   // denormalisasi untuk listing cepat
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at').defaultNow(),
});

// ============ AFFILIATE CLICKS ============
// Raw click log. Tabel ini tumbuh paling cepat — lihat §8 soal retensi.
export const affiliateClicks = mysqlTable('affiliate_clicks', {
  id: int('id').primaryKey().autoincrement(),
  affiliateId: int('affiliate_id').references(() => affiliates.id).notNull(),
  linkId: int('link_id').references(() => affiliateLinks.id),

  visitorId: varchar('visitor_id', { length: 36 }).notNull(),  // UUID di cookie, bukan PII
  ipHash: varchar('ip_hash', { length: 64 }),   // SHA256(ip + salt) — jangan simpan IP mentah
  userAgent: varchar('user_agent', { length: 500 }),
  referer: varchar('referer', { length: 500 }),
  landingPath: varchar('landing_path', { length: 500 }),

  convertedOrderId: int('converted_order_id').references(() => orders.id),
  convertedAt: timestamp('converted_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

// ============ COMMISSION RULES ============
// Aturan komisi berlapis. Resolusi: product > category > tier > global default.
export const commissionRules = mysqlTable('commission_rules', {
  id: int('id').primaryKey().autoincrement(),

  scope: mysqlEnum('rule_scope', ['global', 'tier', 'category', 'product'])
    .notNull(),
  scopeTier: mysqlEnum('scope_tier', ['starter', 'silver', 'gold']),
  categoryId: int('category_id').references(() => categories.id),
  productId: int('product_id').references(() => products.id),

  ratePercent: decimal('rate_percent', { precision: 5, scale: 2 }).notNull(),  // 7.50 = 7.5%
  maxCommission: decimal('max_commission', { precision: 12, scale: 2 }),       // cap per item, nullable

  priority: int('priority').default(0).notNull(),   // makin besar makin menang saat seri
  isActive: boolean('is_active').default(true).notNull(),

  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ AFFILIATE COMMISSIONS (LEDGER) ============
// Satu baris per order_item yang menghasilkan komisi.
// Baris reversal dibuat sebagai entry baru bernilai negatif — TIDAK menghapus/mengubah baris asli.
export const affiliateCommissions = mysqlTable('affiliate_commissions', {
  id: int('id').primaryKey().autoincrement(),
  affiliateId: int('affiliate_id').references(() => affiliates.id).notNull(),
  orderId: int('order_id').references(() => orders.id).notNull(),
  orderItemId: int('order_item_id').references(() => orderItems.id),

  entryType: mysqlEnum('entry_type', ['earning', 'reversal', 'adjustment'])
    .default('earning').notNull(),

  // Snapshot perhitungan — jangan andalkan join saat audit
  baseAmount: decimal('base_amount', { precision: 12, scale: 2 }).notNull(),   // subtotal item setelah diskon
  ratePercent: decimal('rate_percent', { precision: 5, scale: 2 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),            // negatif untuk reversal
  ruleId: int('rule_id').references(() => commissionRules.id),

  status: mysqlEnum('commission_status', [
    'pending',    // order belum delivered
    'holding',    // delivered, menunggu hold period lewat
    'approved',   // masuk saldo, bisa ditarik
    'paid',       // sudah ikut dalam payout
    'rejected',   // order cancelled/expired/fraud
  ]).default('pending').notNull(),

  payoutId: int('payout_id'),          // diisi saat masuk batch payout
  holdUntil: timestamp('hold_until'),
  approvedAt: timestamp('approved_at'),
  rejectedAt: timestamp('rejected_at'),
  rejectReason: varchar('reject_reason', { length: 255 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ AFFILIATE PAYOUTS ============
export const affiliatePayouts = mysqlTable('affiliate_payouts', {
  id: int('id').primaryKey().autoincrement(),
  affiliateId: int('affiliate_id').references(() => affiliates.id).notNull(),

  payoutNumber: varchar('payout_number', { length: 50 }).notNull().unique(),  // "PO-20260802-0001"
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  adminFee: decimal('admin_fee', { precision: 12, scale: 2 }).default('0'),
  netAmount: decimal('net_amount', { precision: 12, scale: 2 }).notNull(),

  // Snapshot rekening saat request — kalau affiliate ganti rekening, history tetap utuh
  bankCode: varchar('bank_code', { length: 20 }).notNull(),
  bankAccountNumber: varchar('bank_account_number', { length: 50 }).notNull(),
  bankAccountName: varchar('bank_account_name', { length: 255 }).notNull(),

  status: mysqlEnum('payout_status', [
    'requested',
    'approved',
    'processing',   // sudah dikirim ke Xendit
    'completed',
    'failed',
    'rejected',
  ]).default('requested').notNull(),

  xenditDisbursementId: varchar('xendit_disbursement_id', { length: 255 }),
  failureReason: text('failure_reason'),
  notes: text('notes'),

  approvedBy: int('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  completedAt: timestamp('completed_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ============ AFFILIATE SETTINGS ============
// Singleton row (id = 1), sejalan dengan pola storeSettings yang sudah ada.
export const affiliateSettings = mysqlTable('affiliate_settings', {
  id: int('id').primaryKey().autoincrement(),

  isEnabled: boolean('is_enabled').default(false).notNull(),
  autoApproveRegistration: boolean('auto_approve_registration').default(false).notNull(),

  cookieWindowDays: int('cookie_window_days').default(30).notNull(),
  holdPeriodDays: int('hold_period_days').default(7).notNull(),

  defaultRatePercent: decimal('default_rate_percent', { precision: 5, scale: 2 })
    .default('5.00').notNull(),

  minPayoutAmount: decimal('min_payout_amount', { precision: 12, scale: 2 })
    .default('50000.00').notNull(),
  payoutAdminFee: decimal('payout_admin_fee', { precision: 12, scale: 2 })
    .default('0').notNull(),

  allowSelfReferral: boolean('allow_self_referral').default(false).notNull(),
  termsContent: text('terms_content'),

  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
```

### 3.2 Perubahan additive pada tabel eksisting

```sql
-- Semua nullable. Aman untuk data lama.
ALTER TABLE orders
  ADD COLUMN affiliate_id INT NULL,
  ADD COLUMN affiliate_code VARCHAR(32) NULL,
  ADD COLUMN affiliate_link_id INT NULL,
  ADD COLUMN affiliate_click_id INT NULL;

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_affiliate
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id);

CREATE INDEX idx_orders_affiliate ON orders(affiliate_id, created_at);
```

Padanan Drizzle di `orders`:

```typescript
  affiliateId: int('affiliate_id').references(() => affiliates.id),
  affiliateCode: varchar('affiliate_code', { length: 32 }),   // snapshot
  affiliateLinkId: int('affiliate_link_id'),
  affiliateClickId: int('affiliate_click_id'),
```

### 3.3 Index yang wajib ada

```sql
CREATE INDEX idx_aff_clicks_visitor    ON affiliate_clicks(visitor_id, created_at);
CREATE INDEX idx_aff_clicks_affiliate  ON affiliate_clicks(affiliate_id, created_at);
CREATE INDEX idx_aff_comm_affiliate    ON affiliate_commissions(affiliate_id, status);
CREATE INDEX idx_aff_comm_order        ON affiliate_commissions(order_id);
CREATE INDEX idx_aff_comm_hold         ON affiliate_commissions(status, hold_until);
CREATE INDEX idx_aff_payouts_affiliate ON affiliate_payouts(affiliate_id, status);
CREATE INDEX idx_comm_rules_lookup     ON commission_rules(scope, is_active, priority);
```

### 3.4 SOP Migrasi (UPDATE — migrasi sekarang otomatis)

> **Koreksi dari versi sebelumnya:** dulu image production standalone tidak punya `drizzle-kit`, jadi migrasi harus manual (SSH + `docker exec` + `ALTER TABLE` manual). Itu sudah tidak berlaku sejak `docs/marketplace/problem-solved/solved-4-otomasi-db-migration.md`. Sekarang ada Docker stage `migrator` terpisah (reuse layer `builder`, isinya `drizzle-kit push --force`) yang otomatis dibangun dan dijalankan oleh `deploy.yml` setiap `git push` ke `main`/`production` — tanpa SSH manual.

Urutan sekarang:

1. Edit `lib/db/schema.ts` di lokal.
2. Jalankan `pnpm build` — pastikan lolos tanpa error.
3. `git push` ke `main` dulu (testing). CI otomatis: build image app + image `migrator`, deploy, lalu jalankan migrasi (`docker run --rm ...:latest-migrate`).
4. Cek log GitHub Actions job "Deploy ke Testing" → step SSH → cari `[✓] Changes applied` (atau "No changes detected" kalau memang tidak ada perubahan).
5. Uji end-to-end di `onetone.kanuraga.web.id`.
6. Kalau aman, `git merge origin/main` ke `production` lalu `push` — proses migrasi yang sama otomatis jalan lagi untuk production (`:production-migrate`).

Detail lengkap mekanismenya: `docs/marketplace/problem-solved/solved-4-otomasi-db-migration.md`.

---

## 4. Alur Teknis

### 4.1 Tracking klik

Route baru: `app/r/[slug]/route.ts` (Route Handler, bukan page — supaya redirect instan tanpa render).

```
GET /r/{slug}
  1. Lookup affiliateLinks by slug → kalau tidak ada / inactive, redirect ke "/" tanpa tracking
  2. Cek affiliate.status === 'active' → kalau tidak, redirect polos
  3. Ambil/buat cookie `_otv` (visitorId, UUID, httpOnly, 1 tahun)
  4. Set cookie `_otref` = { affiliateId, linkId, clickId, exp }
       - httpOnly, sameSite: 'lax', secure, maxAge = cookieWindowDays
       - Ditimpa kalau ada klik baru (last-click wins)
  5. INSERT affiliate_clicks + increment affiliateLinks.clickCount
  6. Redirect 302 ke targetPath + UTM params
```

Rate-limit di step 5: maksimal 1 insert per `visitorId` + `linkId` per 60 detik. Tanpa ini, satu orang refresh 500x bikin statistik affiliate ngawur.

**Alternatif query param:** `?ref=WAWAN23` juga harus jalan (orang suka share link produk asli + suffix). Tangani di `proxy.ts` (Next.js 16 rename dari `middleware.ts` — file konvensi di root project ini sudah bernama `proxy.ts`) — deteksi `ref`, set cookie yang sama, lalu rewrite URL bersih.

### 4.2 Attribution saat checkout

Di `app/actions/orders.ts` → `createOrder()`, **sebelum** insert order:

```typescript
const attribution = await resolveAffiliateAttribution(userId);
// lib/affiliate/attribution.ts

// Aturan reject attribution:
// - affiliate.status !== 'active'
// - affiliate.userId === userId dan !settings.allowSelfReferral  ← self-referral
// - cookie expired
// - channel === 'pos'  ← transaksi kasir tidak pernah kena komisi
```

Hasilnya diisi ke `orders.affiliateId` / `affiliateCode` / `affiliateLinkId` / `affiliateClickId`. Lalu update `affiliate_clicks` row jadi converted.

**Penting:** komisi **belum** dibuat di sini. Order masih `waiting_payment` — bisa expired.

### 4.3 Lifecycle komisi

Tempel ke state machine yang sudah ada di `lib/order-status.ts`:

| Transisi order | Aksi komisi |
|----------------|-------------|
| `waiting_payment` → `packing` (paid) | **CREATE** commission rows, status `pending` |
| → `delivered` | status → `holding`, set `holdUntil = now + holdPeriodDays` |
| Cron: `holding` && `holdUntil < now` | status → `approved` (masuk saldo) |
| → `cancelled` / `expired` | status → `rejected` (kalau masih pending/holding) |
| Refund setelah `approved`/`paid` | **INSERT** baris `reversal` dengan amount negatif |

Kenapa reversal pakai baris baru, bukan update? Karena kalau komisi sudah terlanjur ditarik, saldo bisa jadi negatif — dan itu memang keadaan yang sebenarnya. Menghapus baris asli akan menyembunyikan fakta itu dan bikin rekonsiliasi mustahil.

### 4.4 Resolusi rate komisi

`lib/affiliate/commission.ts`:

```typescript
async function resolveRate(productId, categoryId, tier): Promise<Rule> {
  // Urutan prioritas, ambil yang pertama match & aktif & dalam periode:
  // 1. scope='product'  && productId cocok
  // 2. scope='category' && categoryId cocok
  // 3. scope='tier'     && scopeTier cocok
  // 4. scope='global'
  // 5. fallback: affiliateSettings.defaultRatePercent
  // Kalau seri di scope yang sama, priority DESC menang.
}
```

Perhitungan per item:

```
baseAmount = orderItem.subtotal - (proporsi diskon order untuk item ini)
amount     = round(baseAmount * ratePercent / 100)
if (rule.maxCommission) amount = min(amount, rule.maxCommission)
```

Ongkir tidak pernah masuk basis. Pembulatan ke rupiah penuh (`Math.floor`), sisa pecahan jadi milik toko.

### 4.5 Cron job

Butuh 2 job. Pola paling sederhana untuk setup VPS saat ini: Route Handler yang diproteksi secret + `curl` dari crontab host.

```
app/api/cron/affiliate-approve/route.ts   → tiap jam
  UPDATE komisi holding yang holdUntil sudah lewat → approved

app/api/cron/affiliate-tier/route.ts      → harian, jam 02:00 WIB
  Hitung GMV 30 hari per affiliate → naik/turunkan tier
```

Proteksi: header `x-cron-secret` dibanding `process.env.CRON_SECRET`. Return 401 kalau tidak cocok.

### 4.6 Payout

```
Affiliate request withdraw
  → validasi: saldo approved ≥ minPayoutAmount, rekening lengkap, tidak ada payout 'processing'
  → INSERT affiliate_payouts (status 'requested')
  → UPDATE commissions terkait → status 'paid', payoutId diisi
     (dalam SATU transaction — kalau gagal, rollback semua)

Admin review → approve
  → panggil Xendit Disbursement API
  → status 'processing', simpan xenditDisbursementId

Webhook Xendit → app/api/webhooks/xendit-disbursement/route.ts
  → COMPLETED → payout 'completed'
  → FAILED    → payout 'failed', commissions dikembalikan ke 'approved'
```

**Saldo affiliate selalu dihitung, tidak pernah disimpan:**

```sql
SELECT
  COALESCE(SUM(CASE WHEN status IN ('pending','holding') THEN amount END), 0) AS saldo_tertahan,
  COALESCE(SUM(CASE WHEN status = 'approved'            THEN amount END), 0) AS saldo_tersedia,
  COALESCE(SUM(CASE WHEN status = 'paid'                THEN amount END), 0) AS total_ditarik
FROM affiliate_commissions
WHERE affiliate_id = ?;
```

---

## 5. Anti-Fraud

Minimum yang harus ada di P1:

| Risiko | Mitigasi |
|--------|----------|
| Self-referral | Blok `affiliate.userId === order.userId` saat attribution |
| Referral akun kembar | Flag kalau `ipHash` klik == `ipHash` order, atau alamat kirim sama dengan alamat affiliate |
| Order fiktif lalu cancel | Komisi baru approved setelah `delivered` + hold 7 hari |
| Click farming | Rate-limit insert per visitor+link, dan komisi tidak pernah bergantung pada jumlah klik |
| Kode dipakai di POS | `channel = 'pos'` di-exclude dari attribution |
| Affiliate spam voucher/kupon toko | Kalau nanti ada voucher, order dengan voucher tertentu bisa di-exclude via `commissionRules` |

Tambahan di P2: tabel `affiliate_fraud_flags` + halaman review admin. Untuk P1, cukup kolom `suspended` + alasan manual.

**Conversion rate abnormal** (misal >30% klik jadi order) sebaiknya jadi alert Telegram — reuse channel alert yang sudah ada untuk monitoring VPS.

---

## 6. Halaman & Route

### 6.1 Affiliate (member)

```
app/(shop)/affiliate/
  page.tsx                  → landing: apa itu, komisi berapa, CTA daftar
  register/page.tsx         → form pendaftaran
  dashboard/
    page.tsx                → ringkasan: saldo, klik, konversi, grafik 30 hari
    links/page.tsx          → CRUD link + tombol copy + generator link produk
    commissions/page.tsx    → tabel komisi, filter status
    payouts/page.tsx        → riwayat + form withdraw
    settings/page.tsx       → data rekening, NPWP
```

Guard: layout `affiliate/dashboard` cek `affiliate.status === 'active'`, kalau `pending` tampilkan halaman "menunggu review", kalau belum daftar redirect ke `/affiliate`.

### 6.2 Admin

```
app/(admin)/dashboard/affiliate/
  page.tsx                  → overview: total affiliate, GMV dari affiliate, komisi terutang
  members/page.tsx          → list + approve/reject/suspend
  members/[id]/page.tsx     → detail: performa, komisi, riwayat payout
  commissions/page.tsx      → semua komisi, bisa adjustment manual
  payouts/page.tsx          → antrian withdraw, approve/reject
  rules/page.tsx            → CRUD commission_rules
  settings/page.tsx         → affiliate_settings
```

### 6.3 API (untuk Flutter)

```
POST   /api/affiliate/register
GET    /api/affiliate/me                    → profil + saldo
GET    /api/affiliate/stats?range=30d
GET    /api/affiliate/links
POST   /api/affiliate/links
DELETE /api/affiliate/links/[id]
GET    /api/affiliate/commissions?status=&page=
GET    /api/affiliate/payouts
POST   /api/affiliate/payouts               → request withdraw
PATCH  /api/affiliate/bank-account
```

Semua pakai Bearer token, konsisten dengan endpoint yang sudah ada.

---

## 7. Fase Implementasi

### P1 — MVP (target ~2 minggu)

- [ ] Schema: 6 tabel baru + 4 kolom di `orders` (dengan SOP §3.4)
- [ ] `lib/affiliate/` — `attribution.ts`, `commission.ts`, `balance.ts`, `code-generator.ts`
- [ ] Route `/r/[slug]` + handling `?ref=` di `proxy.ts`
- [ ] Hook attribution di `createOrder()`
- [ ] Hook lifecycle komisi di `lib/order-status.ts`
- [ ] Cron approve komisi
- [ ] Halaman affiliate: landing, register, dashboard, links, commissions
- [ ] Halaman admin: members (approve/reject), commissions, settings
- [ ] Payout **manual** — admin transfer sendiri, lalu tandai completed di sistem
- [ ] Anti-fraud dasar: blok self-referral, rate-limit klik
- [ ] Seed data affiliate untuk testing

**Payout manual di P1 adalah pilihan sadar.** Integrasi Xendit Disbursement butuh KYC bisnis dan saldo mengendap. Sampai volume affiliate jelas, transfer manual jauh lebih murah dan risikonya nol.

### P2 — Otomasi (~1 minggu)

- [ ] Xendit Disbursement + webhook
- [ ] `commission_rules` UI lengkap (per-produk, per-kategori, periode kampanye)
- [ ] Auto tier upgrade/downgrade
- [ ] Grafik performa (klik → order → komisi funnel)
- [ ] Notifikasi: komisi masuk, payout selesai
- [ ] Endpoint API untuk Flutter
- [ ] Export CSV rekap komisi & payout

### P3 — Lanjutan

- [ ] Tab Affiliate di Flutter app
- [ ] `affiliate_fraud_flags` + review queue
- [ ] Two-tier (kalau §2.1 diputuskan berubah)
- [ ] Materi promosi: banner siap-pakai, caption template, katalog gambar produk
- [ ] Leaderboard affiliate (opt-in, hormati privasi)
- [ ] Withholding pajak otomatis

---

## 8. Catatan Operasional

**Retensi `affiliate_clicks`.** Tabel ini paling cepat membengkak. Baris yang sudah lewat cookie window dan tidak converted boleh dihapus:

```sql
DELETE FROM affiliate_clicks
WHERE converted_order_id IS NULL
  AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
LIMIT 10000;
```

Jalankan mingguan, batch, di luar jam sibuk. Baris yang converted **jangan pernah dihapus** — itu bukti audit.

**Backup.** `mysqldump` harian yang sudah jalan sudah otomatis mencakup tabel baru. Tidak perlu perubahan.

**Privasi.** IP disimpan sebagai hash, bukan mentah. `visitorId` adalah UUID acak tanpa PII. Kalau nanti ada kewajiban PDP yang lebih ketat, hash-nya bisa di-rotate tanpa kehilangan fungsi attribution.

**Cookie consent.** Cookie `_otref` adalah cookie fungsional untuk attribution komersial — di yurisdiksi tertentu ini butuh consent. Untuk Indonesia saat ini belum wajib, tapi banner consent sederhana layak dipertimbangkan sebelum ekspansi.

**Terms & Conditions.** Harus ada sebelum affiliate pertama approve. Minimal mencakup: besaran & cara hitung komisi, hold period, minimum withdraw, larangan (bidding brand keyword, klaim palsu, spam), hak toko membekukan akun, dan tanggung jawab pajak.

---

## 9. Prompt untuk Claude Code

Pecah jadi 5 sesi, jangan sekaligus. Setiap sesi berakhir dengan `pnpm build` lolos.

**Sesi 1 — Schema & core lib**
> Baca `docs/devs/dev-affiliates/affiliate-module-plan.md` §3 dan §4.4. Tambahkan 6 tabel affiliate ke `lib/db/schema.ts` beserta relations dan type exports, plus 4 kolom nullable di `orders`. Lalu buat `lib/affiliate/code-generator.ts` (kode unik dari nama user + angka, cek collision) dan `lib/affiliate/commission.ts` (resolusi rate berlapis + hitung komisi per item). Tulis unit test Vitest untuk resolusi rate. Jalankan `pnpm db:push` di lokal seperti biasa untuk sinkronisasi dev — migrasi ke VPS testing/production sudah otomatis lewat `deploy.yml` saat push (lihat §3.4), jadi tidak perlu output SQL manual lagi.

**Sesi 2 — Tracking & attribution**
> Baca §4.1–4.3. Implementasi `app/r/[slug]/route.ts`, handling `?ref=` di `proxy.ts` (Next.js 16 — bukan `middleware.ts`), `lib/affiliate/attribution.ts`, lalu integrasikan ke `createOrder()` di `app/actions/orders.ts` dan lifecycle komisi di `lib/order-status.ts`. Pastikan self-referral dan channel POS ter-exclude.

**Sesi 3 — Dashboard affiliate**
> Baca §6.1. Buat halaman affiliate di `app/(shop)/affiliate/`. Ikuti `docs/design-system/01-color-tokens.md` — primary putih (`bg-primary`) untuk CTA/tombol, gold `#C9A84C` (`bg-premium`) **hanya** di badge tier (Starter/Silver/Gold — atau nama pengganti dari §2.2), bukan aksen umum. Komponen shadcn/ui yang sudah ada. Server Components default, Server Actions untuk mutasi.

**Sesi 4 — Admin panel**
> Baca §6.2. Buat halaman admin affiliate. Pakai `DataTable` yang sudah ada di `components/ui/data-table` mengikuti pola `OrdersTable.tsx`.

**Sesi 5 — Cron, payout manual, seed**
> Baca §4.5, §4.6, §5. Buat cron route dengan proteksi secret, flow payout manual, dan tambahkan seed data affiliate ke `lib/db/seed.ts`.

---

## 10. Checklist Sebelum Go-Live

- [ ] Owner sudah putuskan §2.1–2.4, termasuk nama tier affiliate (hindari tabrakan dengan `member_tiers` "Silver"/"Gold")
- [ ] Terms & Conditions affiliate sudah ditulis dan tayang
- [ ] `affiliate_settings.isEnabled` masih `false` sampai semua siap
- [ ] Push ke `main` dulu, verifikasi migrasi otomatis sukses di log GitHub Actions (lihat §3.4) sebelum merge ke `production`
- [ ] Uji end-to-end di `onetone.kanuraga.web.id`: daftar → approve → klik link → checkout → bayar → delivered → tunggu hold → approved → withdraw
- [ ] Uji jalur negatif: self-referral ditolak, order cancel → komisi rejected, order POS tidak kena komisi
- [ ] Alert Telegram untuk conversion rate abnormal aktif
- [ ] Cron terpasang di crontab VPS dan terbukti jalan