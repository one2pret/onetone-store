# Atomic Voucher Checkout v0.1

**PASS untuk reservasi opt-in pada kernel. BLOCKED untuk aktivasi endpoint.**

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

Sebelum endpoint memilih opsi ini, selesaikan redemption yang idempoten pada pembayaran berhasil, release saat expiry atau pembatalan, dan rekonsiliasi untuk callback ambigu. Callback sandbox saat ini tidak mengelola grant baru ini. Webhook legacy mengelola grant dan penghitung pemakaian di luar satu transaksi bersama. Aktivasi memerlukan pengujian replay, pemulihan reservasi, dan interaksi lintas penulis sebelum kuota terbatas atau `firstOrderOnly` dapat didukung.

Rollback perubahan ini dapat dilakukan dengan revert commit fitur. Perubahan ini memakai kolom dan tabel yang sudah tersedia.
