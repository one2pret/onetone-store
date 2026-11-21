# Atomic Voucher Checkout v0.2

**PASS untuk reservasi opt-in dan lifecycle PAID/EXPIRED sandbox. BLOCKED untuk CANCELLED dan aktivasi endpoint.**

Pemanggil server dapat memilih `benefits: { kind: 'voucher-membership-v1', voucherId, pointsToRedeem }`. Kernel menghitung subtotal dari cart dan harga yang dikunci, mencocokkan snapshot cart dan alamat dari pemanggil, lalu mengambil nilai dan aturan diskon dari database. Voucher dan grant dikunci sebelum reservasi. Order, grant, stok, ledger poin, pengiriman, dan cart ditulis dalam satu transaksi. Retry dengan nomor order yang sama mengembalikan hasil tersimpan.

| Aturan | Perilaku v0.1 |
| --- | --- |
| Masa berlaku | Periksa jadwal kampanye dan tanggal kedaluwarsa grant. Kampanye dengan masa berlaku relatif membutuhkan tanggal pada grant. |
| Minimum belanja dan tier | Gunakan subtotal yang dihitung server dan tier membership yang dikunci. |
| Audience dan kepemilikan | Hanya grant `new_user` milik pengguna, aktif, belum diarsipkan, dan tanpa batas toko. |
| Pemakaian | Hanya satu kali. Grant harus berstatus `available` dan bebas dari referensi reservasi atau redemption sebelumnya. |
| Kuota, `firstOrderOnly`, penggunaan berulang | Tolak. Penulis legacy online, POS, dan webhook belum memiliki satu protokol kuota dan histori lintas jalur. |
| Poin | Terapkan `allowPoints` dari voucher. Validasi jumlah poin terhadap saldo dan total pembayaran di kernel bisnis. |

Suite MySQL membangun skema aplikasi di database lokal yang dihapus setelah tes. Suite menjalankan kernel untuk checkout sukses, retry, persaingan checkout, penolakan kebijakan dan grant, kompatibilitas sandbox dan membership-points, serta rollback ketika stok item kedua tidak mencukupi.

## Lifecycle invoice sandbox

Pada jalur SBX, `orders.voucher_id` mengidentifikasi order opt-in. Invoice dan payment attempt harus cocok dengan ID provider, nomor order, dan nominal seperti pada webhook sandbox yang sudah ada. Pada transisi baru, grant harus dimiliki pengguna order, cocok dengan voucher order, dan masih terikat sebagai reservasi pada order tersebut.

| Callback | Hasil |
| --- | --- |
| PAID | Tandai grant `redeemed` dan isi `redeemed_order_id`. Pembayaran yang cocok menyelesaikan reservasi asli meski grant atau kampanye sudah kedaluwarsa. |
| EXPIRED | Lepas referensi reservasi order. Kembalikan ke `available` hanya jika masa berlaku dan kebijakan saat ini mengizinkan penggunaan kembali. Selain itu, tandai grant `expired`. |
| Replay terminal | Ambil jalur duplikat yang sudah ada tanpa menyentuh grant, termasuk jika grant sudah direservasi order baru. |
| PAID setelah EXPIRED atau EXPIRED setelah PAID | Pertahankan keputusan terminal dan kembalikan `manual_reconciliation_required`. |
| Reservasi hilang atau tidak konsisten | Kembalikan HTTP 503 untuk retry dan rekonsiliasi. Perubahan invoice, order, stok, grant, log, dan payment attempt dibatalkan bersama. |
| CANCELLED | BLOCKED. Parser webhook mengabaikan status ini. Aksi pembatalan web pelanggan dan admin memblokir SBX. API pembatalan legacy menjalankan provider, stok, status, dan grant secara terpisah sehingga tidak memenuhi kontrak atomik ini. |

Suite MySQL menguji callback buatan terhadap invoice dan ledger sandbox lokal. Uji konkurensi, replay setelah reservasi baru, expiry kampanye dan grant, serta kegagalan DB pada update ledger terakhir memeriksa dampak pada pembayaran dan stok.

Sebelum aktivasi endpoint, selesaikan jalur pembatalan SBX dan tetapkan kebijakan pemulihan poin pada expiry untuk order yang memakai voucher dan poin. v0.2 mempertahankan perilaku membership-points yang ada. Kebijakan kuota global, `firstOrderOnly`, dan POS tetap berada di luar dukungan.

Rollback perubahan ini dapat dilakukan dengan revert commit fitur. Perubahan ini memakai kolom dan tabel yang sudah tersedia.
