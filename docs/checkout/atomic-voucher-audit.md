# Atomic Voucher Checkout v0.3

**Kernel sandbox mendukung PAID, EXPIRED, dan pembatalan internal dengan bukti expiry. Aktivasi endpoint tetap diblokir.**

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
| Pembatalan internal terkonfirmasi | `settleConfirmedSandboxCancellation` memerlukan order voucher SBX, satu payment attempt yang cocok, dan bukti invoice provider `EXPIRED` dari pemanggil tepercaya. Order dan invoice lokal menjadi `cancelled`. Ledger provider menjadi `expired` karena invoice provider telah kedaluwarsa. Replay pembatalan hanya dianggap duplikat jika ketiga status terminal konsisten. |
| Callback mentah CANCELLED | Parser tetap mengabaikannya. Aksi pembatalan web memblokir SBX dan API pembatalan legacy menolak order voucher SBX sebelum akses provider atau perubahan stok. |
| Pemulihan poin | Pada EXPIRED atau pembatalan voucher, cocokkan pemilik membership, nilai negatif debit `order_redeem`, dan jumlah poin pada order. Kredit dari debit aktual dicatat sekali sebagai `order_voucher_restore`. Debit hilang, tidak cocok, ganda, atau refund sebelumnya pada order yang masih pending memerlukan rekonsiliasi. Order tanpa debit tidak menerima kredit. |

Checkout sandbox legacy dan membership-points tanpa voucher tetap memakai perilaku sebelumnya. Pada PAID, debit poin dipertahankan. Pembatalan, pemulihan stok, status invoice dan order, grant, kredit poin, log, serta payment attempt memakai transaksi yang sama.

## Checklist sebelum aktivasi

- Review dan luluskan pemeriksaan PR pada commit yang ditinjau.
- Pertahankan opt-in voucher di luar semua endpoint checkout. Kernel hanya memilih voucher jika pemanggil server memberi opsi secara eksplisit.
- Sebelum UAT staging, review dan setujui pemanggil pembatalan internal yang mencocokkan bukti expiry provider dengan invoice. Tangani race antara respons expiry dan webhook serta hasil `conflict` atau HTTP 503. Belum ada pemanggil runtime untuk perintah pembatalan ini.
- Jalankan skenario PAID, EXPIRED, pembatalan, replay, konflik, dan refund pada data UAT yang disetujui setelah integrasi pemanggil. Catat status invoice, order, grant, saldo stok, dan entri ledger poin.
- Pertahankan kuota global, `firstOrderOnly`, dan POS di luar cakupan voucher opt-in.

## Rollback

Untuk kode yang belum diaktifkan, revert commit v0.3 pada branch fitur. Perubahan ini menggunakan skema yang sudah tersedia. Jika fitur suatu hari sudah dipakai, hentikan penerimaan order voucher baru terlebih dahulu dan rekonsiliasi order pending atau ambigu menggunakan bukti provider sebelum rollback. Pertahankan baris order, voucher, stok, dan ledger poin agar replay tetap dapat ditelusuri.
