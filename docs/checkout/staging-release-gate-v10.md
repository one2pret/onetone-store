# Staging Release Gate v1.0 — Atomic Voucher RC v0.9

**NO-GO untuk controlled staging UAT.** PR #95 masuk ke `main`. Build aplikasi dan migrator berhasil, tetapi langkah deployment staging gagal. Runtime dan penyebab kegagalan belum terverifikasi. RC tetap v0.9 (`4afb11b82b6b88a9a6c3d71999381411f224f1fa`).

| Gate | Status | Bukti |
| --- | --- | --- |
| Tujuan dan commit merge | PASS | PR #95 digabung ke `main` sebagai `6057b3424c1814e97f3840b1542c09b58d8420c7`. Parent keduanya adalah readiness `093f6569c149b2757ce694e2c3290a11dc6c7412`. [PR #95](https://github.com/one2pret/onetone-store/pull/95) · [Merge commit](https://github.com/one2pret/onetone-store/commit/6057b3424c1814e97f3840b1542c09b58d8420c7) |
| Branch integrasi | FAIL | Head `feature/atomic-voucher-checkout-v01` yang diperiksa adalah `d818b8dd3241a7d2ebcc82760a6dd7738af40fe7`. Branch itu belum memuat RC v0.9, readiness, atau 0020. Ketiganya ada di `main`. [PR #91](https://github.com/one2pret/onetone-store/pull/91) |
| Pemeriksaan PR dengan tree ekuivalen | PASS | Run PR #95 lulus TypeScript, unit, dan suite checkout/migrasi/paritas MySQL. Tree merge dan tree readiness sama persis, `61b67a707eae7a689ae60f6a0c73abed279042b7`. [CI PR #95](https://github.com/one2pret/onetone-store/actions/runs/44984310622/job/137091415677) |
| Workflow pada SHA merge | FAIL | Build/push kedua image sukses. Langkah `SSH ke VPS Testing & deploy` gagal. Job produksi dilewati. Isi log langkah SSH belum dapat diverifikasi. [Run 44985359491](https://github.com/one2pret/onetone-store/actions/runs/44985359491) · [Job staging](https://github.com/one2pret/onetone-store/actions/runs/44985359491/job/137095024427) |
| Provenance image merge | PASS | Kedua digest di bawah diperiksa di GHCR. Config `linux/amd64` untuk keduanya memuat revisi `6057b3424c1814e97f3840b1542c09b58d8420c7`. [Build image](https://github.com/one2pret/onetone-store/actions/runs/44985359491/job/137094632679) |
| Runtime staging, identitas dan DB | UNVERIFIED | Digest lama yang dilaporkan `sha256:16543928b7568f80579cff96301b0ec72b99b3b790384a31ff25992f79ee751e` tidak memiliki label revisi. Status container aktif, `APP_ENV`, jaringan, dan konektivitas DB setelah job gagal masih memerlukan bukti operator. |
| Jurnal DB staging | UNVERIFIED | Lima baris yang dilaporkan akan gagal memenuhi kontrak 21 entri bila terulang. Hash/timestamp aktual, checkpoint, dan pencatatan 0020 sesudah deployment gagal belum diperiksa. |
| Schema staging, TEST, webhook, flags, log | UNVERIFIED | Perlu hasil preflight dan bukti Xendit TEST dari operator. HTTP 200 hanya membuktikan respons endpoint. |
| Backup, restore rehearsal, UAT | UNVERIFIED | Perlu artefak backup, hasil pemulihan clone, serta persetujuan sebelum transaksi TEST. |

## Provenance dan risiko workflow

Artefak immutable dari build di atas. Simpan keduanya bersama SHA, platform, dan URL run dalam catatan setiap rilis.

| Artefak | Digest index OCI |
| --- | --- |
| App | `sha256:e45cca4beeaa21e58cdb96873098cfe4a6720ba44461920af54a104227ab3602` |
| Migrator | `sha256:7507a3c9908894db5e94574e1f8eabf3d36bb92d7d0197ad02f9c1c5ebd26540` |

Untuk verifikasi independen dari workstation dengan `skopeo` dan `jq`, ambil config masing-masing digest. Kedua pemeriksaan harus cocok dengan SHA build. Ulangi untuk platform runtime yang disetujui jika platform berubah.

```bash
set -eu
sha=6057b3424c1814e97f3840b1542c09b58d8420c7
for digest in \
  sha256:e45cca4beeaa21e58cdb96873098cfe4a6720ba44461920af54a104227ab3602 \
  sha256:7507a3c9908894db5e94574e1f8eabf3d36bb92d7d0197ad02f9c1c5ebd26540; do
  test "$(skopeo inspect --override-os linux --override-arch amd64 --config \
    "docker://ghcr.io/one2pret/onetone-store@$digest" | jq -er '.config.Labels["org.opencontainers.image.revision"]')" = "$sha"
  printf '%s %s\n' "$digest" "$sha"
done
```

Workflow saat ini menambahkan label `org.opencontainers.image.revision` dari `${{ github.sha }}` pada app dan migrator, tetapi deployment menarik `latest` dan `latest-migrate`. Tag dapat bergeser. Gunakan pasangan digest terverifikasi untuk window rilis. Push ke `main` memicu deployment staging dan push ke `production` memicu jalur produksi. Langkah staging menyalin Compose dan menulis konfigurasi sebelum migrator berjalan. Kegagalan langkah SSH membiarkan kondisi konfigurasi, schema, dan container aktif belum pasti. Pertahankan log dan checkpoint. Hindari rerun sebelum investigasi. [Workflow pada merge](https://github.com/one2pret/onetone-store/blob/6057b3424c1814e97f3840b1542c09b58d8420c7/.github/workflows/deploy.yml)

## Satu perintah preflight staging

Prasyarat operator adalah SSH alias `VM-7-242-ubuntu` dengan host key tepercaya, izin Docker lokal di staging, dan checkout **release gate yang sudah direview** dengan dependency Node terpasang. Ganti path checkout di bawah. Tidak perlu memuat `.env` pada shell, menyiapkan secret pada command line, atau menarik image. Jalankan dari workstation operator yang berwenang.

```bash
ssh VM-7-242-ubuntu 'cd /absolute/path/to/reviewed-release-gate-checkout && exec ./node_modules/.bin/tsx scripts/staging-readonly-preflight.ts onetone-app 6057b3424c1814e97f3840b1542c09b58d8420c7 sha256:e45cca4beeaa21e58cdb96873098cfe4a6720ba44461920af54a104227ab3602'
```

Exit `1` menunjukkan FAIL, `3` UNVERIFIED, `2` argumen tidak valid, dan `0` semua pemeriksaan yang dikeluarkan PASS. Dengan token callback saja, delivery tetap UNVERIFIED. Guard memeriksa hostname, socket Docker lokal, dua container dari Compose `/opt/onetone-store/docker-compose.yml`, project dan network yang sama, `APP_ENV=staging`, URL `mysql://…@onetone-db:3306/onetone_db` tanpa opsi URI, dan DNS yang tepat menuju IP DB Docker. Query memakai sesi `READ ONLY`. Tahap error dibatasi pada kategori yang aman. Bagikan JSON teredaksi dari preflight dan jangan bagikan log mentah, environment, token, atau URL database. `structured_logs` mengukur keberadaan event yang dikenali. Review redaksi dan diagnostik untuk order TEST yang diotorisasi dilakukan terpisah.

## Menafsirkan 5 vs 21

Database harus memiliki riwayat yang cocok dengan urutan hash SHA-256 dan timestamp repository serta checkpoint kosong. Untuk 0020 diperlukan satu baris dengan pasangan `1795305600000` dan `513227c7445189cb01c2ee905df1e65c83558b66a45d4914ae291d287f020fbf` pada prefix yang telah diverifikasi. Paritas fisik diperiksa terpisah lewat metadata kolom, tipe, default, indeks, FK, dan CHECK. Kehadiran tabel voucher dan afiliasi saja belum cukup. [Inventaris 21 migrasi](./staging-rc-v09-readiness.md#bukti-migrasi-0020)

| Hasil preflight | Interpretasi dan tindak lanjut |
| --- | --- |
| `incomplete_prefix`, `verifiedPrefixLength: 5` | 0000–0004 cocok. 0005–0020 belum tercatat oleh runner versi ini. Jika skema fisik sudah memenuhi kontrak, ada objek di luar riwayat tercatat. Jika paritas gagal, catat objek yang kurang dan petakan di clone. |
| `history_mismatch` dengan lima baris | Sebagian history berbeda. `firstUnverifiedIndex` adalah indeks mulai dari nol. Cocokkan inventaris dan backup historis. Migrator menolak riwayat non-prefix. |
| `unfinished` lebih dari nol | Operasi DDL bisa sudah ter-commit walaupun baris jurnal belum dibuat. Simpan checkpoint dan bukti. Rekonstruksi kondisi di clone atau pulihkan dari backup yang sudah dilatih. |
| `complete` dengan checksum 0020 cocok | Riwayat tercatat sudah sesuai. Tetap butuh `database_schema: PASS`, checkpoint kosong, dan pemeriksaan integritas data. |

Reproduksi tanpa koneksi DB dengan `npx vitest run tests/unit/staging-preflight-journal.test.ts`. Tes menghitung hash dari file migrasi aktual dan membandingkan dua fixture dengan jumlah lima yang sama, satu prefix valid dan satu riwayat menyimpang. Ada juga fixture checkpoint interupsi, jurnal hilang/kosong, dan 0020 yang berubah, berdiri sendiri, atau duplikat. Penyebab konkret di staging tetap **UNVERIFIED** sampai output host tersedia.

Validasi perubahan preflight lulus TypeScript, ESLint untuk file TypeScript yang berubah, 15 tes terfokus, serta Vitest lokal dengan 795 lulus dan 112 dilewati karena suite yang membutuhkan DB tidak diaktifkan. Probe lokal mengembalikan exit 1 saat dijalankan di luar host staging. Hasil MySQL pada tabel di atas berasal dari CI merge tree PR #95.

## Runbook operator

1. **Preflight dan investigasi.** Jalankan satu perintah di atas. Simpan waktu UTC, SHA/digest aktif, kategori guard, jurnal, checkpoint, schema dan flags. Minta pemilik repository memeriksa langkah SSH yang gagal, lalu catat kategori error dan waktu tanpa secret. Jika guard, history, atau checkpoint gagal, hentikan rencana deploy dan UAT.
2. **Backup.** Dengan izin operator staging, gunakan mekanisme backup konsisten staging dan simpan secara terenkripsi serta terbatas akses. Catat checksum, waktu, engine/versi, baseline jurnal dan checkpoint, serta referensi image app terakhir yang diketahui baik. Lindungi kredensial lewat secret store. Simpan snapshot acuan dengan riwayat utuh. Jangan jalankan schema push atau mengedit jurnal.
3. **Restore rehearsal.** Pulihkan salinan yang disanitasi ke MySQL 8.0.46 disposable dengan schema/akun unik dan tanpa akses ke provider. Validasi target loopback atau jaringan clone yang terisolasi, versi, checksum, relasi, jumlah baris dan integritas referensial. Jalankan prosedur migrasi yang direview hanya pada clone setelah history dipetakan. Periksa checkpoint, 0020, paritas dan retensi data. Ulangi runner untuk menguji idempotensi dan uji app lama terhadap schema hasil migrasi. Simpan bukti rehearsal dan batas waktu pemulihan. [Detail rehearsal](./atomic-voucher-release-candidate-v09.md#rehearsal-database-staging-yang-disanitasi)
4. **Deployment staging terencana.** Persiapkan window terpisah setelah branch dan CI disetujui, pasangan digest tepercaya, baseline DB dipahami, restore sukses, dan backup terbaru tersedia. Operator meninjau perubahan Compose dan target migrator lebih dulu. Gunakan pasangan immutable dan pertahankan voucher serta booking OFF. Sesudah deployment yang disetujui terpisah, ulangi preflight dan cocokkan identitas, schema, jurnal, serta checkpoint sebelum meminta otorisasi UAT.
5. **Rollback dan rekonsiliasi.** Hentikan percobaan baru jika ada kegagalan API, DDL, atau settlement. Pertahankan callback TEST bagi invoice pending selama aman, beserta bukti status provider dan ledger. Gunakan digest aplikasi lama bila kompatibilitasnya telah dilatih. Jika DDL sudah ter-commit, pilih prosedur pemulihan DB dari backup terverifikasi bersama operator dan petakan transaksi setelah backup sebelum restore. Verifikasi ulang order, voucher, stok, poin, invoice, dan checkpoint. Konflik terminal diarahkan ke rekonsiliasi, tanpa membuat invoice kedua atau mengubah status manual. [Runbook rekonsiliasi](./atomic-voucher-release-gate-v06.md)
6. **UAT TEST.** Operator memverifikasi prefix TEST lewat preflight dan akun TEST di dashboard Xendit, tanpa menyalin kunci; cocokkan URL callback dan bukti delivery serta otentikasi token pada fixture yang diotorisasi. Persetujuan sebelum transaksi mencakup window, SHA/digest, akun, fixture sintetis, dan flag yang diperbolehkan. `CHECKOUT_SANDBOX_VOUCHER_ENABLED` default OFF, dengan prasyarat sandbox order dan payment ledger; booking tetap OFF. Gunakan matriks berikut, catat ID uji teredaksi dan bukti settlement, lalu kembalikan flag ke baseline setelah window oleh operator. [Matriks UAT detail](./atomic-voucher-release-candidate-v09.md#checklist-uat-staging)

| Skenario UAT | Bukti yang diperlukan |
| --- | --- |
| Voucher eligible, retry payload sama, perubahan voucher/poin | Satu order, satu invoice, satu reservasi; payload berubah mengembalikan 409. |
| PAID, EXPIRED, trusted cancellation | Identitas invoice/attempt cocok; transisi terminal konsisten; voucher dipakai atau dilepas sekali sesuai status; poin dipulihkan sesuai debit sekali. |
| Replay, out-of-order dan settlement paralel | Bukti status terminal tidak berubah, konflik yang ambigu masuk rekonsiliasi, tanpa efek samping ganda. |
| Provider verification failure dan invoice recovery | Tidak ada invoice kedua; evidence ownership tercatat; pending masuk jalur rekonsiliasi terotorisasi. |
| Stok, invoice dan diagnostik | Cocokkan perubahan stok, ledger dan invoice dengan settlement; tinjau redaksi log dan hasil pending order check. |

**Keputusan** tetap NO-GO sampai branch integrasi, CI, identitas runtime, jurnal/paritas, kredensial serta webhook TEST, rehearsal dan otorisasi operator memiliki bukti yang dapat ditinjau.
