# Tinjauan kesiapan produksi OneTone Store

Audit kode 21 November 2026. Basis `main` adalah `a0ad8b4` dan `production` adalah `ed7a19f`.

| Status | Pemeriksaan dan bukti |
| --- | --- |
| PASS | Pemicu PR hanya menjalankan pemeriksaan. Deploy staging berjalan setelah push ke `main` atau dispatch staging yang dikonfirmasi. Deploy produksi berjalan setelah push ke `production`. |
| BLOCKED | `main` memiliki 200 commit unik dan `production` memiliki satu commit unik, yaitu merge PR #52. Promosi perlu review diff menyeluruh dan keputusan eksplisit. Push ke branch produksi langsung memicu build, migrator, dan deployment. |
| BLOCKED | Lifecycle voucher opt-in memerlukan redemption, release, dan rekonsiliasi atomik sebelum pemanggil endpoint dapat menggunakannya. |
| NOT VERIFIED | Diff menambahkan migrasi 0018 untuk bobot yang disalin saat checkout dan booking sandbox, serta 0019 untuk ledger percobaan pembayaran. Tes MySQL lokal mencakup migrasi terkait pada skema fixture. Status jurnal, durasi DDL, dan kompatibilitas skema produksi memerlukan latihan pada salinan disposable yang disetujui. |
| NOT VERIFIED | Restore backup dan rollback aplikasi belum dilatih. Workflow menghentikan pembaruan aplikasi bila migrator gagal. MySQL DDL dapat tetap diterapkan sebagian dan tag image deployment dapat berubah. Sebelum promosi, simpan digest aplikasi dan migrator lama, uji restore backup, dan uji menjalankan aplikasi lama dengan skema setelah migrasi. |

## Backlog UX web di layar ponsel

Audit kode. Validasi dampak dan urutan melalui pengujian di perangkat.

| Prioritas | Halaman | Pekerjaan |
| --- | --- | --- |
| 1 | Checkout | Uji pemulihan ketika ongkir berubah atau validasi promo gagal. Pertahankan alamat yang masih valid dan arahkan fokus ke pilihan yang perlu diulang. |
| 2 | Cart | Uji perubahan kuantitas dan stok saat jaringan lambat. Tampilkan status perubahan per item dan pastikan nominal serta CTA checkout mudah ditemukan setelah daftar panjang. |
| 3 | Detail produk | Uji opsi varian dan stok. Jelaskan alasan CTA dinonaktifkan dekat pemilih varian dan ukur visibilitas CTA setelah menggulir galeri. |
| 4 | Katalog | Uji filter mobile, hasil kosong, dan navigasi kembali dari produk. Pertahankan filter melalui URL dan periksa pemulihan posisi gulir. |
| 5 | Homepage | Ukur waktu tampil hero dan visibilitas kategori pada viewport kecil. Pastikan kampanye utama punya CTA yang dapat ditemukan dengan mudah. |
