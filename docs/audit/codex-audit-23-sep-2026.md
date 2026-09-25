# Laporan audit read-only — Onetone Store

  Audit dilakukan hanya melalui inspeksi Git, konfigurasi, dokumentasi, dan source code lokal.
  Tidak ada file yang diubah, tidak ada dependency yang dipasang, tidak ada test/build/lint
  yang dijalankan, dan tidak ada koneksi ke database atau layanan eksternal.

  ## A. Ringkasan proyek

  ### Fakta

  Onetone Store adalah aplikasi e-commerce single-store untuk fashion/sportswear, dengan
  storefront pelanggan, admin dashboard, POS, membership, voucher, dan affiliate.

  Stack utama:

  - Next.js 16.2.4, React 19.2.5, TypeScript 5.9.3.
  - Tailwind CSS 4.2.4 dan komponen Radix/shadcn.
  - MySQL 8 dengan Drizzle ORM 0.38.4 dan mysql2.
  - NextAuth v5 beta dengan Credentials dan JWT.
  - Xendit untuk invoice pembayaran.
  - Biteship/“Bitship” untuk tarif dan shipment.
  - Cloudflare R2 melalui AWS S3 SDK.
  - Vitest 4.1.5.
  - Docker image Node 20 Alpine.

  Bukti: package.json:1, pnpm-lock.yaml:2790, README.md:1.

  ### Git

  - Branch aktif: ai/codex-continuation.
  - Working tree: bersih.
  - Untracked: tidak ada.
  - Remote: origin → https://github.com/one2pret/onetone-store.git.
  - Lima commit terakhir:

   Commit        Tanggal    Ringkasan
  ━━━━━━━━━  ━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   b01dd0b    2026-08-23    Bake custom CDN URL ke production build
  ─────────  ────────────  ──────────────────────────────────────────
   735f472    2026-08-23    Tambah NEXT_PUBLIC_CDN_URL ke Dockerfile
  ─────────  ────────────  ──────────────────────────────────────────
   2886aaa    2026-08-22    Merge PR #30 dari production
  ─────────  ────────────  ──────────────────────────────────────────
   9cbf108    2026-08-22    Perbaikan upload/import gambar Drive
  ─────────  ────────────  ──────────────────────────────────────────
   597c302    2026-08-22    Merge PR #29 dari main

  File ignored penting:

  - .env, .env.local, .env.production.
  - .claude/settings.local.json.
  - .next/, node_modules/.
  - Artefak lokal .DS_Store.
  - .impeccable session/cache.

  Hanya .env.example yang tracked. Isi file environment aktual tidak dibuka.

  ### Dugaan

  Bagian terakhir yang aktif dikerjakan adalah pipeline CDN/R2 dan pengalaman import gambar
  Google Drive, berdasarkan commit 22–23 Agustus 2026.

  ### Belum diketahui

  - Kondisi database nyata dan kesesuaian schema produksi.
  - Status merchant Xendit/Biteship: sandbox atau production.
  - Apakah branch ini sudah pernah melewati test/build setelah commit terakhir.
  - Coverage numerik karena coverage tidak dikonfigurasi/dijalankan.

  ———

  ## B. Fakta terverifikasi beserta path dan symbol

  ### Instruksi dan dokumentasi

  Dokumen utama ditemukan:

  - README.md:1
  - CLAUDE.md:1
  - PRODUCT.md:1
  - DESIGN.md:1
  - docs/DEV-PLAN-CHECKLIST.md:1
  - docs/integration-plan.md:1
  - docs/missing-flows.md:1
  - Dokumentasi POS, affiliate, deployment, Xendit, Biteship, design system, dan workflow AI di
    docs/.

  Tidak ada AGENTS.md di repo ini. AGENTS.md yang ditemukan berada di repo sibling dan tidak
  berlaku.

  Tidak ditemukan ADR formal. integration-plan.md, missing-flows.md, PRODUCT.md, dan dokumen
  modul bertindak sebagai requirement/development notes. Tidak ada changelog formal.

  ### Aturan Claude lama yang masih relevan

  Aturan yang masih sesuai implementasi:

  - Server Component secara default.
  - Mutasi web melalui Server Actions; REST API untuk mobile/eksternal.
  - Validasi input menggunakan Zod.
  - Gunakan Drizzle, bukan interpolasi raw SQL.
  - Seluruh upload melalui lib/storage.ts.
  - Object key disimpan di DB dan URL dibangun melalui CDN.
  - Harga memakai decimal.
  - Semua mutasi sensitif wajib memeriksa session dan role.
  - Status order harus mengikuti state machine.
  - Abstraction layer dipakai untuk storage, payment, shipping, dan stok.

  Aturan/catatan yang sudah kedaluwarsa atau bertentangan:

  - “POS admin-only” sudah tidak benar sepenuhnya; schema memiliki role cashier, dan pos-
    sessions.ts menerima admin/cashier.

  - “Marketplace deferred/single-store only” tidak mencerminkan adanya route group marketplace,
    store channel, membership, dan affiliate.

  - Checklist lama masih menyebut upload gambar dan user management belum ada, sementara
    implementasi keduanya ditemukan.

  - Sprint aktif di CLAUDE.md menyebut storage/image/Drive belum dikerjakan, tetapi file dan
    commit terbaru menunjukkan implementasi sudah ada.

  - README menyebut Flutter, tetapi tidak ditemukan source project Flutter dalam repo ini.

  ———

  ## C. Arsitektur dan alur data

  ### Struktur utama

   Lokasi               Fungsi
  ━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   app/(marketplace)    Homepage, kategori, search, store, account, affiliate
  ───────────────────  ───────────────────────────────────────────────────────
   app/(shop)           Katalog/detail produk dan halaman brand lama
  ───────────────────  ───────────────────────────────────────────────────────
   app/(checkout)       Cart, address, checkout, order
  ───────────────────  ───────────────────────────────────────────────────────
   app/(auth)           Login dan register
  ───────────────────  ───────────────────────────────────────────────────────
   app/(admin)          Dashboard dan operasi back-office
  ───────────────────  ───────────────────────────────────────────────────────
   app/(pos)            Kasir/POS
  ───────────────────  ───────────────────────────────────────────────────────
   app/api              REST API, cron, webhook
  ───────────────────  ───────────────────────────────────────────────────────
   app/actions          Server Actions web
  ───────────────────  ───────────────────────────────────────────────────────
   components/shop      UI storefront/checkout
  ───────────────────  ───────────────────────────────────────────────────────
   components/admin     UI admin
  ───────────────────  ───────────────────────────────────────────────────────
   components/pos       UI POS
  ───────────────────  ───────────────────────────────────────────────────────
   lib/db               Schema, koneksi, migration, seed
  ───────────────────  ───────────────────────────────────────────────────────
   lib/affiliate        Attribution dan lifecycle komisi
  ───────────────────  ───────────────────────────────────────────────────────
   tests                Unit, action, dan API tests

  ### Entry point service

  - Next.js: app/layout.tsx, route groups di app/.
  - Auth middleware/proxy: proxy.ts:19.
  - Database: lib/db/index.ts:1.
  - Web API: route handlers di app/api/**/route.ts.
  - Production container: node server.js dari standalone build.
  - Migration container: npx drizzle-kit push --force.
  - Tidak ditemukan worker queue terpisah.
  - Tidak ditemukan Redis/cache server; cache yang tampak hanya Next.js/CDN/browser caching.
  - Storage: Cloudflare R2/S3-compatible, bukan local upload.

  ### Alur checkout

  Session user
    → cart_items
    → pilih address
    → minta tarif Biteship
    → createOrder
    → hitung harga/voucher/poin
    → insert order + items + shipping
    → deduct stock
    → hapus cart
    → buat Xendit invoice
    → Xendit webhook mengubah order ke packing
    → admin membuat shipment Biteship
    → Biteship webhook mengubah shipping/delivered

  Bukti utama: createOrder di app/actions/orders.ts:35, POST di app/api/orders/route.ts:1,
  webhook Xendit dan Biteship.

  ### Database

  ORM dan DB:

  - Drizzle ORM + MySQL.
  - Pool mysql2, timezone UTC.
  - Schema: lib/db/schema.ts:15.
  - Migration: lib/db/migrations/.
  - Seed demo: lib/db/seed.ts.
  - Seed production tambahan: scripts/seed-production.ts.

  Model utama:

  - Identity: users, addresses.
  - Catalog: categories, products, product_variants, product_images.
  - Shopping: cart_items.
  - Order: orders, order_items, invoices, shippings, shipping_histories, order_status_logs.
  - Store/POS: stores, store_settings, pos_sessions.
  - Loyalty: member_tiers, memberships, vouchers, points_ledger.
  - Affiliate: affiliates, affiliate_links, affiliate_clicks, commission_rules,
    affiliate_settings, affiliate_commissions, affiliate_payouts.

  - Marketing: banners.

  Relasi penting didefinisikan melalui relations() mulai lib/db/schema.ts:581.

  ### Risiko schema/migration

  Hanya ditemukan satu migration SQL. Migration tersebut tidak membuat tabel affiliate,
  sedangkan schema TypeScript sudah memilikinya. Deployment menggunakan drizzle-kit push
  --force, bukan apply migration versioned.

  Ini menciptakan risiko drift schema dan perubahan destruktif yang sulit direview atau
  rollback. Bukti:

  - lib/db/migrations/0000_thin_doctor_doom.sql:1
  - lib/db/migrations/meta/_journal.json:1
  - Dockerfile:38
  - .github/workflows/deploy.yml:1

  ———

  ## D. Matriks status fitur

  Status di bawah berarti status implementasi statis, bukan bukti runtime. “Terverifikasi
  selesai” digunakan hanya jika jalur utama, validasi, dan test relevan ditemukan; test belum
  dijalankan dalam audit ini.

   Fitur                  Status                                 Bukti dan catatan
  ━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Auth/login/register    Ada tetapi belum lengkap               Credentials, bcrypt, cookie
                                                                 JWT, Bearer JWT tersedia.
                                                                 Tidak ada rate limit/login
                                                                 throttling. AUTH_SECRET punya
                                                                 fallback tidak aman.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   User/profile           Ada tetapi belum lengkap               Profile dan password API
                                                                 tersedia; admin member pages
                                                                 ada. Guard members.ts
                                                                 bermasalah.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Product/catalog        Rusak/berisiko                         Katalog, detail, CRUD,
                                                                 images, variants tersedia;
                                                                 mutation produk tidak
                                                                 memiliki internal admin
                                                                 guard.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Category               Rusak/berisiko                         CRUD lengkap secara struktur;
                                                                 seluruh mutation Server
                                                                 Action tanpa admin guard.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Search/filter          Ada tetapi belum lengkap               Product search, category,
                                                                 admin search, nuqs; admin
                                                                 search tidak memiliki guard
                                                                 internal.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Cart                   Ada tetapi belum lengkap               Web action dan REST API
                                                                 tersedia; belum ada bukti uji
                                                                 konkurensi/varian lintas
                                                                 produk.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Checkout               Rusak/berisiko                         Alur lengkap ada, tetapi
                                                                 harga ongkir diterima dari
                                                                 form client dan transaksi
                                                                 tidak atomik.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Address                Terverifikasi selesai secara statis    CRUD, ownership, default
                                                                 address, API dan test
                                                                 ditemukan. Runtime belum
                                                                 diuji.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Shipping               Rusak/berisiko                         Rate, shipment, tracking ada;
                                                                 webhook Biteship tanpa
                                                                 signature/token verification.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Payment                Ada tetapi belum lengkap               Xendit invoice, webhook
                                                                 token, expire/repay tersedia;
                                                                 invoice creation failure
                                                                 dapat meninggalkan order
                                                                 tanpa invoice.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Order                  Ada tetapi belum lengkap               List/detail/cancel/repay/
                                                                 status log/state machine
                                                                 tersedia; beberapa perubahan
                                                                 lintas tabel tidak atomik.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Inventory/stock        Rusak/berisiko                         Validate/deduct/restore
                                                                 tersedia, tetapi pola read-
                                                                 then-decrement tanpa row lock
                                                                 memungkinkan overselling/
                                                                 negative stock.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Promotion/banner       Terverifikasi selesai secara statis    CRUD banner dengan admin
                                                                 guard dan public endpoint.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Voucher/discount       Ada tetapi belum lengkap               Voucher dan membership
                                                                 discount tersedia; quota
                                                                 check/increment rentan race.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Membership/points      Ada tetapi belum lengkap               Tier, points ledger, redeem/
                                                                 earn tersedia; konsistensi
                                                                 transaksi perlu audit lanjut.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Admin                  Rusak/berisiko                         Dashboard dan banyak modul
                                                                 tersedia; beberapa Server
                                                                 Action admin tidak melakukan
                                                                 authorization sendiri.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   POS                    Ada tetapi belum lengkap               Session, transaksi, receipt,
                                                                 cash reconciliation tersedia.
                                                                 pos-orders.ts hanya menerima
                                                                 admin sementara session layer
                                                                 menerima cashier—potensi role
                                                                 inconsistency.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Affiliate              Ada tetapi belum lengkap               Attribution, link,
                                                                 commission, payout UI, cron
                                                                 ditemukan; payout
                                                                 disbursement eksternal belum
                                                                 terbukti aktif.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Notification           Tidak ditemukan                        Tidak ada email/SMS/push/
                                                                 admin notification service.
                                                                 Hanya UI toast dan count/
                                                                 dashboard.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Storage/image          Ada tetapi belum lengkap               R2, Sharp, upload dan Drive
                                                                 import tersedia; runtime/CDN
                                                                 permission tidak
                                                                 diverifikasi.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Analytics              Tidak ditemukan                        Tidak ada provider analytics;
                                                                 dashboard aggregation bukan
                                                                 analytics eksternal.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Queue                  Tidak ditemukan                        Cron HTTP dipakai untuk
                                                                 pekerjaan berkala.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Multi-store            Belum dapat dipastikan                 Ada tabel stores, route /
                                                                 stores/[slug], dan channel;
                                                                 requirement tetap menyebut
                                                                 single-store.
  ─────────────────────  ─────────────────────────────────────  ───────────────────────────────
   Flutter app            Tidak ditemukan                        REST API disiapkan untuk
                                                                 Flutter, tetapi source
                                                                 Flutter tidak ada di repo.

  ———

  ## E. Test/build command yang ditemukan

  Tidak ada command berikut yang dijalankan.

   Tujuan                  Command repo
  ━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Development             pnpm dev
  ──────────────────────  ─────────────────────────────────────────────────────────────────────
   Build                   pnpm build
  ──────────────────────  ─────────────────────────────────────────────────────────────────────
   Start                   pnpm start
  ──────────────────────  ─────────────────────────────────────────────────────────────────────
   Lint                    pnpm lint
  ──────────────────────  ─────────────────────────────────────────────────────────────────────
   Test watch              pnpm test
  ──────────────────────  ─────────────────────────────────────────────────────────────────────
   Test sekali             pnpm test:run
  ──────────────────────  ─────────────────────────────────────────────────────────────────────
   Type-check eksplisit    Tidak ada script; konfigurasi mendukung pnpm exec tsc --noEmit
  ──────────────────────  ─────────────────────────────────────────────────────────────────────
   Push schema             pnpm db:push — berisiko, jangan dijalankan tanpa review
  ──────────────────────  ─────────────────────────────────────────────────────────────────────
   DB studio               pnpm db:studio
  ──────────────────────  ─────────────────────────────────────────────────────────────────────
   Seed                    pnpm db:seed — destruktif terhadap data lokal menurut implementasi
                           seed

  Bukti: package.json:5, vitest.config.ts:1, tsconfig.json:1.

  Test ditemukan:

  - Unit: stock, order status, membership, voucher, commission, Xendit, Biteship, utils.
  - Actions: address, category, product, order, shipping, courier, store settings.
  - API: auth, cart, address, product, order, banner, webhook, cron.
  - Tidak ada disabled test (skip, todo, xit, xdescribe) yang ditemukan.

  Coverage gap penting:

  - Authorization negatif untuk Server Actions admin.
  - Concurrent checkout/row locking.
  - Manipulasi ongkir dari client.
  - POS createPosOrder.
  - Product variant ownership.
  - Affiliate payout end-to-end.
  - R2/Drive failure and cleanup.
  - Biteship webhook authenticity.
  - Migration compatibility.
  - Browser/E2E checkout lengkap.
  - Tidak ada coverage config/report.

  ———

  ## F. Risiko

  ### Critical

  1. Server Actions katalog dapat memodifikasi data tanpa admin authorization.

     createProduct, updateProduct, createDraftProduct, deleteProduct, CSV import, variant
     upsert/stock update, serta category CRUD tidak memanggil auth() atau guard role.

     Bukti:
      - app/actions/products.ts:122
      - app/actions/product-variants.ts:45
      - app/actions/categories.ts:31

     Dampak: pengguna yang dapat memanggil action endpoint berpotensi membuat, mengubah, atau
     menghapus produk/kategori/stok. Proteksi halaman /dashboard tidak menggantikan
     authorization pada action.

  2. Data customer/member dapat dibaca melalui action tanpa admin guard.

     getMembers, getMember, dan getMemberOrders tidak memiliki pemeriksaan session/role.

     Bukti: app/actions/members.ts:8.

  ### High

  1. Webhook Biteship tidak diverifikasi.

     Handler langsung mempercayai order_id dan status, lalu dapat menandai delivered/cancelled,
     mengembalikan stok, dan mengubah komisi.

     Bukti: app/api/webhooks/bitship/route.ts:12.

  2. Race condition stok dan overselling.

     validateStock() membaca stok terlebih dahulu, kemudian deductStock() melakukan decrement
     terpisah tanpa transaction, FOR UPDATE, atau kondisi stock >= quantity.

     Bukti: lib/stock.ts:9, app/actions/orders.ts:35.

  3. Ongkir dipercaya dari input client.

     courierPrice diambil dari FormData, lalu dipakai untuk total dan shipping record. Tidak
     terlihat server-side binding terhadap hasil rate yang sebelumnya diterbitkan Biteship.

     Bukti: createOrder di app/actions/orders.ts:35.

  4. Fallback secret JWT yang predictable.

     Bila AUTH_SECRET hilang, mobile JWT ditandatangani memakai string fallback tetap.

     Bukti: lib/api-auth.ts:9.

  5. Deploy menjalankan schema push paksa.

     Pipeline memakai drizzle-kit push --force terhadap database deploy. Ditambah drift antara
     migration SQL dan schema affiliate, ini berisiko perubahan tak terreview atau data loss.

     Bukti: Dockerfile:38.

  ### Medium

  - Order, items, shipping, stock, poin, dan cart tidak selalu dibungkus satu transaksi;
    partial failure dapat menciptakan data tidak konsisten.

  - Xendit invoice gagal hanya dicatat ke log, tetapi order dapat tetap sukses tanpa
    paymentUrl.

  - Webhook Xendit melakukan beberapa update sebelum transaction membership; kegagalan
    pertengahan bisa meninggalkan state parsial.

  - Biteship webhook belum deduplicate history event.
  - Login membedakan “email tidak terdaftar” dan “password salah”, memungkinkan account
    enumeration.

  - Tidak ditemukan rate limiting pada login, register, API, webhook, atau cron.
  - Token API berlaku 30 hari tanpa revocation/session identifier.
  - Role pada JWT cookie baru diperbarui saat sign-in; perubahan role di DB tidak otomatis
    invalidasi session aktif.

  - allowedOrigins Server Actions hanya memuat domain testing dan localhost; domain production
    tidak terlihat.

  - products.image, banner image, dan beberapa href menerima URL/string; React menekan HTML
    XSS, tetapi validasi skema URL/domain belum konsisten.

  - Seed utama membersihkan tabel dan me-reset auto increment; sangat destruktif bila salah
    environment.

  - Migration SQL tidak merepresentasikan semua tabel/kolom schema saat ini.
  - POS authorization tidak konsisten: session actions menerima cashier, order action terlihat
    admin-only.

  - Affiliate cookies bersifat HttpOnly/SameSite tetapi attribution integrity dan fraud
    protection belum sepenuhnya terbukti.

  ### Low

  - README dan dokumen sprint banyak yang stale.
  - Repo memiliki dua lockfile (pnpm-lock.yaml dan package-lock.json) dan Docker memakai npm
    sementara dokumentasi meminta pnpm; resolusi dependency dapat berbeda.

  - tsconfig.json mengecualikan tests dari type-check.
  - Tidak ada script type-check atau coverage.
  - Dokumentasi deployment lama masih memakai nama “NextElektronik”.
  - Tidak ditemukan monitoring/log aggregation formal.
  - Beberapa demo credential terdokumentasi; tampak sebagai credential demo, tetapi jangan
    digunakan di environment nyata.

  - Tidak ada error.tsx/loading.tsx yang menonjol dalam route utama meski aturan Claude
    memintanya.

  ### Secret scan lokal

  - .env* aktual di-ignore dan tidak dibuka.
  - Tidak ditemukan file secret environment yang tracked.
  - Pencarian pola hanya menunjukkan placeholder/test values dan dokumentasi.
  - Tidak bisa memastikan sejarah Git bebas secret tanpa audit seluruh blob/history khusus;
    audit ini tidak menampilkan nilai apa pun.

  ### SQL injection, XSS, CSRF, CORS

  - SQL injection: query aplikasi umumnya memakai Drizzle parameterized query. Raw SQL dinamis
    ditemukan di seed, bukan request path.

  - XSS: tidak ditemukan dangerouslySetInnerHTML, eval, atau new Function.
  - CSRF: NextAuth dan Server Action memiliki mekanisme origin/cookie, tetapi REST mutation
    juga menerima cookie session; tidak ada kebijakan CSRF eksplisit yang ditemukan.

  - CORS: tidak ditemukan konfigurasi permissive Access-Control-Allow-Origin; ini lebih aman
    secara default, tetapi kebutuhan Flutter/API cross-origin belum terdokumentasi.

  - Input validation: banyak jalur memakai Zod, tetapi tidak merata pada seluruh action/
    webhook.

  ———

  ## G. Fitur setengah jadi

  1. Security hardening: checklist sendiri masih menandai rate limiting, sanitization, CSRF,
     dan secure headers belum selesai.

  2. Admin advanced: chart belum ada; member management ada tetapi guard internal kurang.
  3. Notification: admin notification/email/push belum ada.
  4. Shipping reliability: webhook authenticity, deduplication, dan sync fallback belum
     selesai.

  5. Checkout consistency: belum atomik dan belum aman dari concurrent checkout.
  6. Payment recovery: order tanpa invoice bisa terjadi jika Xendit gagal.
  7. Schema lifecycle: schema affiliate sudah ada, migration versioned yang sesuai tidak ada.
  8. Affiliate payout: UI dan ledger ada, tetapi disbursement nyata belum terverifikasi.
  9. Flutter: API disiapkan, aplikasinya tidak ditemukan.
  10. UI polish/SEO: docs mencatat breadcrumb, related product, loading/empty states, sitemap,
     dan metadata belum merata.

  11. POS: refund/return, barcode, offline, dynamic QRIS, dan reprint memang sengaja ditunda.

  ———

  ## H. Pertanyaan yang belum terjawab

  ### Bisnis

  - Apakah aplikasi tetap single-store, atau route marketplace/multi-store akan menjadi produk
    utama?

  - Apakah role cashier boleh membuat transaksi POS, atau tetap admin-only?
  - Apakah harga ongkir boleh disubsidi selain membership/voucher?
  - Kebijakan pembatalan setelah packing dan retur setelah delivered bagaimana?
  - Kapan stok dianggap reserved: saat order dibuat atau setelah pembayaran?
  - Apakah voucher boleh digunakan satu kali per customer?
  - Apakah points redemption memiliki maksimum per order?
  - Siapa menanggung biaya affiliate dan pajaknya?
  - Apakah affiliate payout akan manual atau Xendit disbursement?
  - Channel pembayaran Xendit mana yang sudah diaktifkan?
  - Apakah Biteship sudah live dan menyediakan webhook signature/token untuk akun ini?
  - Notifikasi order masuk harus melalui email, WhatsApp, dashboard, atau push?
  - Apakah aplikasi Flutter tetap berada dalam scope?

  ### Teknis/operasional

  - Schema database testing/production saat ini berasal dari migration atau db:push?
  - Apakah ada backup otomatis sebelum schema push?
  - Apakah secret production pernah memakai nilai demo/default?
  - Domain production yang benar mana, dan mengapa tidak ada di allowedOrigins?
  - Apakah .env.production lokal adalah artefak aman atau salinan konfigurasi nyata?
  - Apakah branch ai/codex-continuation dimaksudkan sebagai continuation dari main atau
    production?

  - Apakah 231 test yang disebut dokumen masih benar setelah fitur affiliate/POS terakhir?

  ———

  ## I. Rekomendasi urutan pekerjaan

  1. Tutup authorization gap terlebih dahulu. Tambahkan guard admin terpusat pada seluruh
     mutation produk, variant, category, member, dan admin search/data read.

  2. Amankan webhook Biteship. Validasi signature/token sesuai mekanisme resmi dan tambah
     replay/idempotency protection.

  3. Perbaiki checkout sebagai transaksi atomik. Lock row stok, validasi produk–varian,
     conditionally decrement, insert order/items/shipping, redeem point, dan clear cart dalam
     satu transaction.

  4. Jangan percaya harga ongkir client. Kirim ID/quote token; lookup atau hitung ulang tarif
     di server.

  5. Hilangkan fallback auth secret. Fail-fast saat AUTH_SECRET kosong dan rancang revocation/
     shorter lifetime untuk Bearer token.

  6. Ganti schema push paksa dengan migration versioned. Generate/review migration, backup,
     dry-run, dan rollback plan sebelum deploy.

  7. Tambah failure recovery payment. Beri state payment_setup_failed atau retry aman bila
     invoice gagal.

  8. Tambahkan regression/security tests untuk authorization, concurrency, tampered shipping,
     webhook spoof/replay, dan partial failure.

  9. Selaraskan role POS antara proxy/layout, session actions, dan POS order actions.
  10. Rapikan dokumentasi setelah behavior dan deployment stabil.

  ———

  ## J. Usulan task pertama dengan scope kecil

  Task pertama: harden authorization pada Product Server Actions.

  Scope kecil:

  - Buat/reuse helper requireAdmin().
  - Terapkan pada mutation:
      - createProduct
      - updateProduct
      - createDraftProduct
      - deleteProduct
      - importProductsFromCsv

  - Tambahkan test negatif: anonymous dan customer mendapat Unauthorized/Forbidden.
  - Jangan sekaligus mengubah schema, UI, upload, atau checkout.

  Alasan prioritas: permukaan perubahan kecil, mudah dites, dan menutup jalur modifikasi
  katalog tanpa otorisasi yang saat ini berseverity Critical.

  Audit berhenti di sini sesuai instruksi; repo tidak diubah.