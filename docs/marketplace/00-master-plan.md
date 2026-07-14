# 00 — Master Plan: Onetone Store → Marketplace

> **Model mental inti:** Marketplace adalah **shell**. Boutique Onetone yang sekarang
> menjadi **toko resmi pertama** di dalam shell itu. Bukan dua aplikasi terpisah —
> satu aplikasi yang berevolusi tanpa regresi ke admin/POS/boutique yang sudah jalan.

---

## Tujuan Owner (dikonfirmasi)

1. `onetone-store.id` → tampilan **marketplace** (pola UX ala Shopee) sebagai default.
2. Boutique Onetone yang sekarang → menjadi **satu toko resmi** di dalam marketplace, tetap punya storefront-nya sendiri (semacam landing + e-commerce toko).
3. **Membership**: data member tercatat, bisa diberi diskon, gratis ongkir, poin — dan berkembang ke depan.
4. Customer bisa akses **profil, status membership, history** dengan mudah (tab "Saya" ala marketplace).
5. **Tahap lanjut:** layanan PPOB (listrik, air, pulsa), multi-seller penuh.

## Prinsip Non-Negosiasi

- **Zero regression.** Route group `(admin)` dan `(pos)` tidak disentuh. Mereka pakai token & API yang sama; berubah otomatis hanya di warna.
- **Additive, bukan destructive.** Semua tabel baru menambah, tidak mengubah kolom lama yang breaking. `store_id` ditambahkan nullable → backfill ke store Onetone.
- **"Shopee" = pola UX, bukan skin.** Adopsi bottom-nav, search-first header, grid kategori, tab "Saya". Render dalam identitas **white-dark** (lihat `01-rebrand-white-dark.md`). Hasilnya: "dark marketplace" — pembeda nyata vs Shopee/Tokopedia yang terang.
- **MVP multi-seller = struktural saja.** Tabel `stores` ada, tapi tanpa onboarding seller / payout di MVP. Onetone = satu-satunya store dulu.

---

## Struktur Route — Sebelum & Sesudah

### Sekarang
```
app/
  (shop)/      → home boutique, products, cart, checkout, orders, account
  (admin)/     → dashboard
  (pos)/       → kasir
  (auth)/      → login, register
  api/         → REST (Flutter)
```

### Sesudah
```
app/
  (marketplace)/           → BARU. Root "/" = home marketplace (Shopee-style)
    page.tsx               → feed produk lintas-toko, banner, kategori grid
    categories/            → browse per kategori
    search/                → hasil pencarian global
    stores/[slug]/         → halaman toko (Onetone = /stores/onetone)
    account/               → tab "Saya": profil, membership, poin, voucher, history
  (shop)/  → tetap ada, tapi jadi storefront toko Onetone
    onetone/               → landing + katalog boutique Onetone (dipindah dari "/")
  (checkout)/              → cart, checkout, orders DIPROMOSIKAN jadi global
                             (melayani lintas-toko, bukan milik satu route group)
  (admin)/                 → TIDAK DIUBAH
  (pos)/                   → TIDAK DIUBAH
  (auth)/                  → TIDAK DIUBAH
  api/                     → tambah endpoint stores, membership, vouchers
```

> Catatan: nama route group bisa disesuaikan dengan struktur aktual saat eksekusi.
> Yang penting: home marketplace di `/`, boutique dipindah ke slug toko, cart/checkout/orders jadi global.

---

## Fase Eksekusi

| Fase | Nama | Isi | Prasyarat |
|------|------|-----|-----------|
| **0** | Rebrand white-dark | Swap token gold→white (lihat `01-rebrand-white-dark.md`) | — |
| **1** | Data model additive | Tabel `stores`, `memberships`, `member_tiers`, `points_ledger`, `vouchers`. Tambah `store_id` nullable ke `products`/`orders`, backfill ke Onetone | 0 |
| **2** | Marketplace shell + routing | Route group `(marketplace)` di `/`, boutique → `/stores/onetone`, promosikan cart/checkout/orders jadi global | 1 |
| **3** | Account area ("Saya") | Hub profil, status membership, poin, voucher, history — pola tab Shopee | 2 |
| **4** | Membership mechanics | Apply voucher, gratis ongkir, earn/redeem poin di checkout; auto-upgrade tier | 1, 3 |
| **5+** | Deferred | PPOB (listrik/air/pulsa), seller onboarding + payout, seller dashboard | — |

Fase 0 independen dari 1–4 (murni visual), bisa jalan paralel dengan planning fase lain.

---

## Fase 1 — Data Model (Drizzle, additive)

Sketsa arah; sesuaikan dengan `lib/db/schema.ts` aktual saat eksekusi.

```ts
// stores — Onetone = row pertama, isOfficial=true
export const stores = mysqlTable('stores', {
  id: varchar('id', { length: 36 }).primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),   // "onetone"
  name: varchar('name', { length: 150 }).notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  isOfficial: boolean('is_official').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// member_tiers — Silver/Gold/Platinum + benefit
export const memberTiers = mysqlTable('member_tiers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),             // "Gold"
  minSpend: int('min_spend').default(0),                       // ambang upgrade (Rupiah)
  discountPct: int('discount_pct').default(0),                 // diskon default tier
  freeShippingThreshold: int('free_shipping_threshold'),        // null = tidak dapat
  pointMultiplier: int('point_multiplier').default(1),
});

// memberships — 1 user : 1 membership
export const memberships = mysqlTable('memberships', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().unique(),
  tierId: varchar('tier_id', { length: 36 }).notNull(),
  points: int('points').default(0),
  totalSpend: int('total_spend').default(0),                   // akumulasi untuk upgrade
  joinedAt: timestamp('joined_at').defaultNow(),
});

// points_ledger — audit poin (earn/redeem), jangan cuma simpan saldo
export const pointsLedger = mysqlTable('points_ledger', {
  id: varchar('id', { length: 36 }).primaryKey(),
  membershipId: varchar('membership_id', { length: 36 }).notNull(),
  orderId: varchar('order_id', { length: 36 }),
  delta: int('delta').notNull(),                               // + earn, - redeem
  reason: varchar('reason', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// vouchers — diskon / gratis ongkir
export const vouchers = mysqlTable('vouchers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  type: mysqlEnum('type', ['fixed', 'percent', 'free_shipping']).notNull(),
  value: int('value').default(0),
  minSpend: int('min_spend').default(0),
  storeId: varchar('store_id', { length: 36 }),               // null = berlaku global
  tierId: varchar('tier_id', { length: 36 }),                 // null = semua tier
  quota: int('quota'),
  usedCount: int('used_count').default(0),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  isActive: boolean('is_active').default(true),
});

// PERUBAHAN ADDITIVE ke tabel lama:
// products.storeId  varchar(36)  nullable  → backfill ke store Onetone
// orders.storeId    varchar(36)  nullable  → backfill ke store Onetone
// orders.voucherId  varchar(36)  nullable
// orders.pointsEarned int default 0
// orders.pointsRedeemed int default 0
```

Migrasi: `drizzle-kit push` via container Docker sementara di app-network (pola yang sudah kamu pakai).

---

## Fase 3 — Account Area ("Saya")

Pola tab Shopee, isi Onetone. Sub-halaman di `(marketplace)/account/`:

- **Profil** — nama, foto, kontak, edit.
- **Membership** — tier sekarang, progress bar ke tier berikutnya (`totalSpend` vs `minSpend`), benefit aktif.
- **Poin** — saldo + riwayat dari `points_ledger`.
- **Voucher Saya** — voucher yang dimiliki / bisa diklaim.
- **Pesanan** — history + tab status (sudah ada, tinggal dipindah/link).
- **Alamat** — buku alamat (sudah ada).

Mobile: bottom-nav 4–5 item — Beranda / Kategori / (Keranjang) / Notifikasi / Saya.

---

## Fase 4 — Membership di Checkout

- Input/klaim voucher → validasi `type`, `minSpend`, `tierId`, `storeId`, kuota, tanggal.
- Gratis ongkir: dari `member_tiers.freeShippingThreshold` atau voucher `free_shipping`.
- Poin: hitung earn = `subtotal × tier.pointMultiplier` (aturan main disederhanakan), tulis ke `points_ledger` saat order `paid`. Redeem = kurangi total, catat delta negatif.
- Upgrade tier: setelah order `paid`, `totalSpend += subtotal`; jika lewat ambang tier berikutnya → naik tier.

Semua mutasi poin/tier lewat `points_ledger` + transaksi DB (jangan hanya update saldo — perlu audit trail, sama seperti pola order-status-log kamu).

---

## Fase 5+ — Deferred (jangan kerjakan di MVP)

- **PPOB** — listrik/air/pulsa/BPJS. Butuh provider agregator (mis. jenis Xendit-adjacent). Tabel `bill_payments` terpisah. **Out of scope MVP.**
- **Seller onboarding & payout** — pendaftaran seller, verifikasi, split payment, penarikan dana. **Out of scope MVP.** Struktur `stores` sudah disiapkan agar tinggal diperluas.

---

## Prompt Claude Code per Fase

### Fase 1 — Data model
```
Tambahkan model marketplace additive ke lib/db/schema.ts sesuai
docs/marketplace/00-master-plan.md bagian "Fase 1":
tabel stores, member_tiers, memberships, points_ledger, vouchers.
Tambahkan kolom nullable storeId ke products & orders, plus voucherId,
pointsEarned, pointsRedeemed ke orders. JANGAN ubah/hapus kolom lama.
Buat seed: 1 store "onetone" (isOfficial=true) + 3 tier (Silver/Gold/Platinum).
Tulis skrip backfill storeId semua products & orders ke store onetone.
Generate migration via drizzle-kit. Jangan jalankan push otomatis —
tunjukkan SQL-nya dulu.
```

### Fase 2 — Routing shell
```
Refactor routing jadi marketplace shell sesuai docs/marketplace/00-master-plan.md
bagian "Struktur Route". Buat route group (marketplace) dengan home "/" berisi
feed produk lintas-store + grid kategori + banner (pola Shopee, skin white-dark).
Pindahkan home boutique lama ke /stores/onetone. Promosikan cart/checkout/orders
jadi route global lintas-store. JANGAN sentuh (admin) dan (pos). Pastikan semua
link internal & middleware diperbarui. pnpm build harus zero error.
```

### Fase 3 — Account area
```
Bangun (marketplace)/account sesuai docs/marketplace/00-master-plan.md "Fase 3":
sub-halaman Profil, Membership (progress tier), Poin (dari points_ledger),
Voucher Saya, Pesanan (link ke yang ada), Alamat. Tambah bottom-nav mobile.
Pakai token white-dark. Badge tier boleh pakai text-premium (jika Opsi B rebrand).
```

### Fase 4 — Membership checkout
```
Integrasikan membership ke checkout sesuai docs/marketplace/00-master-plan.md "Fase 4":
input voucher + validasi, gratis ongkir per tier/voucher, earn/redeem poin lewat
points_ledger dalam transaksi DB, auto-upgrade tier setelah order paid.
Semua mutasi poin/tier harus punya audit trail. Tambah test untuk validasi voucher
dan perhitungan poin.
```

---

## Urutan Rekomendasi

**0 → 1 → 2 → 3 → 4.** Fase 0 (rebrand) boleh duluan/paralel karena murni visual. Fase 1 fondasi data untuk 3 & 4. Fase 2 mengubah kerangka; kerjakan setelah data siap agar store page langsung punya konteks store.

Sebelum eksекусi, kunci 3 keputusan owner:
1. Opsi warna: A (monokrom murni) atau B (+ micro-gold membership).
2. Konfirmasi multi-seller MVP = struktural saja (tanpa onboarding/payout).
3. Konfirmasi PPOB deferred keluar scope MVP.
