# Atomic Voucher Checkout v0.4

**Kernel dan jalur opt-in staging tersedia untuk review. Aktivasi UAT menunggu CI pada commit integrasi dan persetujuan operator.**

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
| Callback mentah CANCELLED | Parser tetap mengabaikannya. Aksi pembatalan web memblokir SBX dan API pembatalan order voucher SBX menggunakan pembacaan invoice TEST untuk memastikan expiry. API bayar ulang legacy menolak order voucher SBX dan mengarahkan kasus ke rekonsiliasi. |
| Pemulihan poin | Pada EXPIRED atau pembatalan voucher, cocokkan pemilik membership, nilai negatif debit `order_redeem`, dan jumlah poin pada order. Kredit dari debit aktual dicatat sekali sebagai `order_voucher_restore`. Debit hilang, tidak cocok, ganda, atau refund sebelumnya pada order yang masih pending memerlukan rekonsiliasi. Order tanpa debit tidak menerima kredit. |

Checkout sandbox legacy dan membership-points tanpa voucher tetap memakai perilaku sebelumnya. Pada PAID, debit poin dipertahankan. Pembatalan, pemulihan stok, status invoice dan order, grant, kredit poin, log, serta payment attempt memakai transaksi yang sama.

## Aktivasi staging setelah review

Operator yang berwenang dapat menyiapkan runtime staging secara terpisah setelah CI lulus. Pastikan `APP_ENV=staging`, kunci invoice Xendit TEST dengan scope baca dan pembuatan invoice, serta callback TEST yang terautentikasi. Checkout voucher memakai jalur tarif existing dengan `BITSHIP_API_KEY` berformat TEST dan origin `https://api.biteship.com`. Akses pembuatan shipment tidak diperlukan.

Flag baru `CHECKOUT_SANDBOX_VOUCHER_ENABLED` efektif hanya jika nilainya `true` dan kedua flag sandbox existing juga aktif, yaitu `CHECKOUT_SANDBOX_ORDER_ENABLED` dan `CHECKOUT_SANDBOX_PAYMENT_LEDGER_ENABLED`. Nilai contoh adalah `false`. Untuk UAT yang disetujui, berikan flag voucher hanya pada runtime staging. Workflow yang sudah ada membaca konfigurasi aplikasi dari `ENV_TEST` dan mengelola kedua flag sandbox existing melalui variabel staging. Pertahankan flag voucher OFF di semua runtime lain dan pertahankan booking OFF.

### Checklist UAT

- Siapkan akun dan grant TEST milik akun yang sama, SKU dengan stok uji, dan alamat uji. Rekam saldo stok dan poin awal.
- Kirim checkout sandbox dengan `Idempotency-Key` UUID dan `voucher: { id, pointsToRedeem }`. Verifikasi nominal dari server, status grant `reserved`, dan satu payment attempt. Ulangi request dengan kunci sama. Perubahan pilihan voucher atau poin dengan kunci sama harus menghasilkan 409.
- Selesaikan satu invoice TEST dan verifikasi `PAID`, grant `redeemed`, serta replay tanpa efek tambahan. Ulangi checkout dengan kunci sama dan periksa bahwa tautan invoice terminal disembunyikan.
- Pada order terpisah tunggu invoice provider kedaluwarsa. Pembatalan voucher pada `POST /api/orders/{id}/cancel` memakai GET invoice yang terautentikasi. Jika webhook EXPIRED sudah menang, respons pembatalan mengarahkan ke rekonsiliasi dan status terminal tetap tercatat. Jika pembatalan menang, status lokal menjadi `cancelled`. Verifikasi stok kembali, grant dilepas atau kedaluwarsa sesuai kebijakan, dan poin dipulihkan sekali.
- Uji invoice aktif, identitas salah, dan provider tidak tersedia. Pastikan tidak ada perubahan saldo, stok, atau grant. Bukti dari permintaan checkout atau cancel pelanggan tidak menentukan status invoice. Umur bukti maksimal 30 detik sejak lookup dimulai sampai verifikasi di bawah lock.
- Kosongkan antrean order TEST pending sebelum menutup UAT. Simpan bukti yang sudah disamarkan.

## Rollback

Matikan flag voucher staging untuk mencegah checkout voucher baru dan menonaktifkan perintah pembatalan internal dari API. Pertahankan jalur webhook sandbox dan ledger selama rekonsiliasi invoice pending. Setelah pending dan konflik direkonsiliasi, revert commit integrasi bila diperlukan. Simpan baris order, voucher, stok, invoice dan poin. Perubahan menggunakan skema yang sudah tersedia.
