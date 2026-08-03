# Panduan Penggunaan Fitur Affiliate

Dokumen ini buat siapa aja yang mau paham/demo fitur affiliate — bukan dokumentasi teknis (itu ada di `affiliate-module-plan.md` dan `testing-lokal.md`). Ada dua alur: **Affiliate** (customer yang promosiin toko) dan **Admin** (yang kelola program).

---

## Gambaran Umum

```
Customer daftar jadi affiliate
        ↓
Admin approve
        ↓
Affiliate dapat kode + bikin link
        ↓
Affiliate share link (IG/TikTok/WA)
        ↓
Orang lain klik link → belanja → checkout
        ↓
Order selesai (delivered) + lewat masa tunggu 7 hari
        ↓
Komisi cair ke saldo affiliate
        ↓
Affiliate ajukan tarik saldo
        ↓
Admin approve → transfer manual → tandai selesai
```

---

## BAGIAN 1 — Alur Affiliate (Customer)

### Langkah 1: Daftar

1. Login sebagai customer.
2. Buka menu **Akun Saya** (klik nama/avatar di kanan atas) → klik **Affiliate**. Atau langsung ke halaman `/affiliate`.
3. Baca halaman "Jadi Affiliate Onetone" — ada penjelasan cara kerja (3 langkah) dan ketentuan singkat (komisi, cookie window, minimum withdraw).
4. Klik tombol **"Daftar Jadi Affiliate"**.
5. Isi form:
   - **Nama publik** (wajib) — nama yang muncul di link/promosi.
   - Instagram / TikTok / YouTube (opsional).
   - Perkiraan jumlah followers (opsional).
   - Kenapa mau jadi affiliate (opsional, buat pertimbangan admin).
6. Klik **"Kirim Pendaftaran"**.
7. Muncul halaman **"Pendaftaran sedang direview"** — tunggu admin approve (lihat Bagian 2).

> Kalau admin sudah aktifin "auto-approve" di pengaturan, langkah 7 dilewati — langsung aktif dan masuk dashboard.

### Langkah 2: Setelah Disetujui — Dashboard

Setelah admin approve, buka `/affiliate/dashboard`. Ada 5 menu di sidebar kiri:

**Ringkasan**
- Kode affiliate sendiri (misal `ANDI88`) + badge tier (Starter/Pro/Elite).
- Tombol **"Salin Link"** — copy link toko dengan kode sendiri (`?ref=KODE`).
- 3 kartu saldo: **Tersedia** (bisa ditarik), **Tertahan** (masih proses), **Total Ditarik**.
- 3 kartu statistik: Total Klik, Konversi, Conversion Rate.

**Link Saya**
- Buat link baru: pilih tujuan (halaman utama toko / produk tertentu / kategori tertentu / path custom), kasih catatan (opsional, misal "IG Story Januari").
- Klik **"Buat Link"** → link baru muncul di list bawah dengan tombol **Salin**.
- Setiap link nunjukin jumlah klik yang udah masuk.
- Bisa nonaktifkan link (ikon tempat sampah) kalau udah gak dipakai.

**Komisi**
- Tabel riwayat komisi, bisa difilter: Semua / Menunggu / Masa Tunggu / Disetujui / Ditarik / Ditolak.
- Tiap baris: tanggal, nomor order, rate %, nominal, status.

**Penarikan**
- Kartu saldo tersedia + tombol **"Tarik Saldo"** (aktif kalau saldo ≥ minimum dan data rekening udah lengkap).
- Riwayat penarikan sebelumnya + statusnya.

**Pengaturan**
- Form data rekening: Bank, Nomor Rekening, Nama Pemilik Rekening, NPWP (opsional).
- **Wajib diisi dulu** sebelum bisa tarik saldo.

### Langkah 3: Share Link

Ambil link dari halaman **Link Saya** (format `https://domain.com/r/{kode-link}`) atau link cepat dari **Ringkasan** (`https://domain.com/?ref=KODE`). Share ke Instagram, TikTok, WhatsApp, dst.

Orang yang klik link akan otomatis "dilacak" 30 hari (default) — kalau dalam 30 hari itu mereka checkout, affiliate dapat komisi walau gak checkout di klik pertama.

### Langkah 4: Komisi Masuk

Ketika ada yang belanja lewat link affiliate:
1. Order dibuat → status komisi **"Menunggu"** (pending) — belum tentu jadi duit, order masih bisa batal.
2. Order dibayar (paid) → status tetap pending, nunggu proses kirim.
3. Order sampai ke pembeli (delivered) → status jadi **"Masa Tunggu"** (holding) — mulai hitung mundur 7 hari (default), buat jaga-jaga ada retur.
4. Lewat 7 hari tanpa masalah → otomatis jadi **"Disetujui"** (approved) — sekarang masuk saldo tersedia, bisa ditarik.

### Langkah 5: Tarik Saldo

1. Pastikan data rekening udah diisi di **Pengaturan**.
2. Buka **Penarikan**, klik **"Tarik Saldo"** (kalau saldo tersedia ≥ minimum, misal Rp50.000).
3. Semua saldo tersedia otomatis diajukan (bukan tarik sebagian).
4. Status jadi "Diajukan" — tunggu admin approve dan transfer manual (lihat Bagian 2).
5. Setelah admin tandai selesai, status jadi "Selesai" dan saldo masuk ke rekening.

---

## BAGIAN 2 — Alur Admin

### Langkah 0: Aktifkan Program (sekali di awal)

1. Login sebagai admin.
2. Sidebar kiri → klik **Affiliate**.
3. Dari halaman **Overview**, klik kartu **"Pengaturan"**.
4. Centang **"Program affiliate aktif"** — tanpa ini, halaman `/affiliate` nolak pendaftaran baru.
5. Opsional: centang **"Auto-approve pendaftaran"** kalau gak mau approve manual tiap orang daftar.
6. Atur juga: cookie window (default 30 hari), hold period (default 7 hari), default rate (default 5%), minimum payout (default Rp50.000), admin fee, dan Terms & Conditions.
7. Klik **"Simpan Pengaturan"**.

### Langkah 1: Overview

Halaman **Affiliate** (`/dashboard/affiliate`) nunjukin:
- Total affiliate + berapa yang aktif.
- Berapa yang masih menunggu review.
- GMV (total nilai order) yang datang dari affiliate.
- Komisi terutang (yang masih harus dibayar ke semua affiliate).
- Shortcut ke 5 sub-halaman.

### Langkah 2: Approve Pendaftaran Baru

1. Klik **"Kelola Affiliate"** (atau sidebar → Affiliate → Members).
2. Filter status **"Menunggu"** buat lihat yang baru daftar.
3. Klik **Approve** buat aktifkan, atau **Reject** buat tolak (ada konfirmasi dulu).
4. Klik nama affiliate buat lihat detail lengkap: performa, riwayat komisi, riwayat penarikan.

### Langkah 3: Kelola Affiliate Aktif

Dari halaman detail affiliate (`/dashboard/affiliate/members/{id}`):
- Lihat total link, total earned, data sosial media.
- Kalau ada masalah (indikasi curang, dll), klik **"Bekukan Akun"**, isi alasan wajib — komisi affiliate itu otomatis ditahan.
- Affiliate yang dibekukan bisa diaktifkan lagi dari halaman list (tombol "Aktifkan Lagi").

### Langkah 4: Pantau & Koreksi Komisi

Halaman **Semua Komisi** (`/dashboard/affiliate/commissions`):
- Semua komisi dari semua affiliate, bisa difilter per status.
- Kalau perlu koreksi manual (misal ada kesalahan hitung, atau mau kasih bonus), klik **"+ Adjustment Manual"** — isi affiliate ID, order ID, nominal (boleh negatif buat pengurangan), dan alasan. Ini masuk sebagai entri terpisah (bukan ubah data lama), jadi riwayat tetap utuh buat audit.

### Langkah 5: Proses Penarikan Saldo

Halaman **Antrian Withdraw** (`/dashboard/affiliate/payouts`):
1. Filter **"Diajukan"** buat lihat permintaan baru.
2. Cek data rekening yang tampil (bank, nomor rekening, nama pemilik).
3. Klik **Approve** kalau valid, atau **Reject** (isi alasan) kalau ada masalah.
4. Setelah approve, **transfer manual** ke rekening affiliate lewat mobile banking/apps bank seperti biasa (sistem belum otomatis transfer di versi ini).
5. Setelah transfer beneran terkirim, klik **"Tandai Selesai (Transfer Manual)"** di baris yang sama.

> Kalau di-reject, komisi yang sempat "dikunci" buat penarikan itu otomatis balik ke status "Disetujui" — affiliate bisa ajukan ulang.

### Langkah 6: Atur Rate Komisi Custom (Opsional)

Halaman **Aturan Komisi** (`/dashboard/affiliate/rules`):
- Default semua affiliate dapat rate sesuai Pengaturan (misal 5%).
- Bisa bikin aturan khusus: per tier (misal affiliate tier Elite dapat 10%), per kategori produk, atau per produk spesifik (misal produk clearance cuma 2%, produk baru 12% buat boost promosi).
- Urutan menang: **Produk spesifik > Kategori > Tier > Default global**. Kalau ada 2 rule di level yang sama, yang **priority**-nya lebih besar menang.
- Rule bisa dinonaktifkan sementara (tombol "Nonaktifkan") tanpa dihapus, atau dihapus permanen.

---

## Istilah Penting

| Istilah | Artinya |
|---|---|
| **Kode affiliate** | Kode unik per affiliate (misal `ANDI88`), dipakai di link `?ref=KODE` |
| **Cookie window** | Berapa lama klik "diingat" — kalau checkout dalam periode ini, affiliate tetap dapat komisi walau gak checkout langsung |
| **Last-click wins** | Kalau orang klik link Affiliate A lalu Affiliate B sebelum checkout, yang dapat komisi B (klik terakhir) |
| **Hold period** | Masa tunggu setelah order selesai sebelum komisi cair — buat jaga-jaga ada retur/komplain |
| **Self-referral** | Affiliate pakai link sendiri buat beli produk sendiri — otomatis diblokir (kecuali admin izinkan di Pengaturan) |
| **Tier** | Level affiliate (Starter/Pro/Elite), naik otomatis tiap hari berdasar GMV 30 hari terakhir, mempengaruhi rate komisi kalau ada rule per-tier |
| **GMV** | Total nilai order (Gross Merchandise Value) yang datang dari link affiliate |

## FAQ Singkat

**Q: Affiliate bisa lihat siapa yang beli dari link-nya?**
A: Enggak — cuma lihat jumlah klik, konversi, dan nominal komisi. Data pembeli (nama, alamat) gak ditampilkan ke affiliate, cuma admin.

**Q: Kalau order di-cancel setelah affiliate dapat komisi pending, gimana?**
A: Otomatis komisi itu berubah status jadi "Ditolak" — gak ada tindakan manual yang perlu dilakukan.

**Q: Kalau order sudah delivered dan komisi udah approved, tapi ternyata ada refund?**
A: Admin perlu buat "reversal" (baris komisi negatif) lewat adjustment manual — kurangi saldo affiliate senilai komisi yang harus dibalikin.

**Q: Berapa lama proses approve pendaftaran?**
A: Manual oleh admin, gak ada batas waktu otomatis. Kalau mau instant, aktifkan auto-approve di Pengaturan.

**Q: Kenapa affiliate gak bisa tarik saldo padahal ada saldo tersedia?**
A: Cek dua hal: (1) data rekening di Pengaturan udah lengkap belum, (2) saldo tersedia udah di atas minimum payout belum.
