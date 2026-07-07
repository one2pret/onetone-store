# Product

## Register

product

## Users

**Admin (pemilik UMKM / bisnis personal):**
- Bekerja dari HP/tablet sebagian besar waktu, laptop di rumah/kantor kecil
- Konteks: solo operator atau tim 2-3 orang, tidak punya bagian IT
- Job to be done: kelola katalog produk, terima order online, jalankan POS offline saat ada pembeli datang langsung, rekap penjualan harian tanpa perlu Excel manual
- Prioritas: cepat & tidak error saat rush jam ramai; audit trail cukup jelas untuk urusan kas

**Customer (pembeli end-user):**
- Mobile-first (>80% traffic), koneksi 4G Indonesia (kadang lambat)
- Konteks: browse produk sambil scrolling social, sudah familiar Shopee/Tokopedia tapi mencari toko yang "beda"
- Job to be done: temukan produk yang cocok, lihat stok/varian jelas, checkout tanpa banyak klik, bayar via QRIS/VA/e-wallet
- Prioritas: foto produk jelas, harga transparan, tahu pasti kapan barang sampai

**Kasir POS (persona overlap dengan Admin):**
- Konteks: di depan customer fisik, HP/tablet di tangan
- Job to be done: cari produk cepat, pilih varian, terima bayar tunai/QRIS, print/kirim struk
- Prioritas: satu tap = satu action; UI tidak boleh nge-freeze saat customer nunggu

## Product Purpose

Onetone adalah aplikasi **e-commerce single-store** untuk UMKM fashion sportswear di Indonesia. Beda dari marketplace: satu brand, satu suara, katalog dikurasi.

Nilai inti yang dibawa:
1. **Stok terpusat** — jualan di online, POS offline, dan (nanti) Flutter app pakai satu stok yang sama. Tidak ada double-selling.
2. **Bermuka dua tapi satu keluarga** — customer melihat storefront yang terasa seperti brand-nya sendiri (bukan template). Admin dapat back-office yang efisien tanpa Excel.
3. **Indonesian-native** — Rupiah, alamat provinsi/kota/kecamatan, kurir lokal (Bitship), pembayaran QRIS/VA/e-wallet (Xendit). Bukan lokalisasi seadanya dari template asing.

Sukses diukur dari: admin bisa jalankan operasional 30 hari tanpa developer intervensi, customer complete checkout dalam <90 detik dari landing.

## Brand Personality

**Tiga kata:** Premium · Confident · Effortless

**Voice & tone:**
- Bicara langsung, tanpa jargon marketing. "Beli", "Bayar", "Sesi Ditutup" — bukan "Amankan Slot Anda Sekarang".
- Angka dan status jujur. Kalau stok habis, bilang habis. Tidak ada "hurry only 2 left!" fake scarcity.
- Konteks lokal tanpa gaul lebay. "Terima kasih atas kunjungan Anda" bukan "Makasih kakak!".

**Emotional targets:**
- **Customer** merasa: "Ini toko yang tahu apa yang mereka jual" — kepercayaan dari kejelasan, bukan dari testimonial spam.
- **Admin** merasa: "Alat ini bekerja untukku, bukan aku yang bekerja untuk alat" — efisiensi tanpa perlu belajar terminologi baru.

**Reference titik nyala (in-brand):**
- **Lululemon / Arc'teryx** — refined athletic. Layout tenang, produk sebagai hero, whitespace berani.
- **Uniqlo** — grid clean, harga forward, minimum ornament. Efisien untuk browse cepat di HP.
- **Toko Instagram premium lokal** — foto dominan, video-first, sedikit teks. Feels dikurasi, bukan dijejalkan.

## Anti-references

Yang **HARUS DIHINDARI**:

1. **Marketplace look ala Shopee/Tokopedia** — badge neon (Best Seller, Flash Sale, Diskon 50%), banyak banner sticker mepet, product card padat info dan bintang review, warna oranye/merah dominan. Kalau kelihatan seperti marketplace, kita gagal jadi single-store.

2. **SaaS-cream landing page 2025** — body warm off-white (parchment/paper/linen), huge display heading dengan clamp berlebihan, gradient orb blur di corner, testimonial slider, "Trusted by 10,000+", tiny uppercase tracked eyebrow di setiap section. Terlalu generic-AI dan tidak sesuai brand fashion.

3. **Gradient hero dengan 3D orb/blob** — mesh gradient purple/blue/pink dengan blob floating, glassmorphism card di atasnya, floating logos brand generik. Overused di landing page AI-generated post-2023, dan sama sekali tidak nyambung dengan brand sportswear.

## Design Principles

1. **Single store, distinctive voice.** Setiap keputusan visual harus terasa "milik Onetone", bukan komponen template yang bisa dipasang di brand mana pun. Kalau ini bisa jadi Shopee generic seller dashboard, kita salah arah.

2. **Product photography adalah hero.** Layout, tipografi, warna semua adalah frame untuk foto produk. Ornament visual di luar foto harus minimal dan konfident. Foto kacau > layout mewah; foto bagus > layout kompleks.

3. **Effortless commerce, not effortful design.** Friction minimum: satu tap addition ke cart, satu screen untuk pilih varian, satu form untuk bayar. Design yang keliatan effortless butuh keputusan yang kuat — bukan effortless untuk kita yang bikin.

4. **Dual persona, one family.** Admin (dashboard/POS) dan customer (shop) punya bahasa visual berbeda — admin lebih fungsional, customer lebih editorial — tapi keduanya jelas berasal dari brand yang sama (dark-gold token, tipografi konsisten, sudut radius sama).

5. **Indonesian context, world-class execution.** Rupiah bukan alasan untuk feels murah. Alamat provinsi/kecamatan bukan alasan untuk form berantakan. Eksekusi visual harus setara Lululemon/Arc'teryx meski konteksnya UMKM lokal.

## Accessibility & Inclusion

**Target:** WCAG 2.1 AA compliance untuk semua surface publik (shop + auth).

**Konkret:**
- Body text contrast ≥ 4.5:1 di dark theme (default) dan light theme
- Focus ring visible dengan gold accent, keyboard navigable end-to-end
- Semua tombol utama minimum 44×44px tap target (Indonesian mobile users, ukuran HP variatif)
- Screen reader labels di bahasa Indonesia untuk semua interactive element
- `prefers-reduced-motion` respected — animasi gold-shimmer & fadeInUp harus punya alternatif static
- Placeholder text tidak dipakai sebagai label satu-satunya (form aksesibel dengan `<label>`)

**Konteks Indonesia:**
- Skala font harus tetap terbaca di HP entry-level (screen density rendah). Base 14px minimum untuk body.
- Copy dalam Bahasa Indonesia sebagai default (jangan English placeholder yang lupa diterjemahkan).
- Nominal Rupiah harus jelas — pisahkan ribuan dengan titik (`Rp 175.000`) bukan koma.

**Yang tidak menjadi prioritas MVP:** AAA compliance (kontras 7:1), full screen reader landmark structure (dilakukan di P2 saat audit menyeluruh), i18n multi-language.
