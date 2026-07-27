# Solved 4 — Otomasi DB Migration di CI/CD (2026-07-27)

## Objektif

Menghilangkan langkah manual "migrate schema ke VPS" dari proses deploy. Sebelumnya tiap ada perubahan `lib/db/schema.ts`, admin/developer harus SSH manual ke VPS dan jalanin serangkaian perintah Docker sendiri. Sekarang migrate jalan otomatis sebagai bagian dari `git push` ke `main`/`production`.

## Sebelum

**Masalah:** image production adalah Next.js **standalone build** — cuma berisi `server.js` + file hasil build, **tidak ada** `node_modules` atau `drizzle-kit` di dalamnya. Jadi gak bisa jalanin `pnpm db:push` dari dalam container app yang sedang berjalan.

**Workaround manual (sebelum perubahan ini):**
```bash
# SSH ke VPS, lalu:
docker run --rm --network onetone-store_onetone-net node:20-alpine sh -c "
  apk add git &&
  git clone https://github.com/one2pret/onetone-store.git /app &&
  cd /app &&
  npm install -g pnpm &&
  pnpm install &&
  pnpm db:push --force
"
```

**Kenapa ini berisiko:**
- Harus diingat manual tiap ada schema change — gampang lupa, deploy jalan tapi DB gak ke-update.
- `git clone` di dalam container ambil branch HEAD saat itu juga, bisa gak sinkron persis sama commit yang lagi di-build/di-deploy.
- `pnpm install` full dari nol tiap kali dijalanin — lambat, dan gak konsisten sama dependency versi yang sebenarnya kepakai di image production.
- Butuh akses SSH manual — satu titik kegagalan manusia (human-error) di tiap deploy yang ubah schema.

## Sesudah

**Perubahan:** tambah satu Docker build stage baru (`migrator`) yang reuse layer dari stage `builder` yang sudah ada — jadi bukan build dari nol, cuma nambah satu image kecil di CI. Image ini isinya sama persis kayak kode yang lagi di-deploy (bukan clone terpisah), tinggal dijalanin `docker run --rm` sekali abis app-nya `up -d`.

### File yang berubah

**1. `Dockerfile`** — tambah stage baru di antara `builder` dan `runner`:
```dockerfile
# ── Stage 2: Migrator ──────────────────────────────────────────────────────────
FROM builder AS migrator
CMD ["npx", "drizzle-kit", "push", "--force"]
```
Stage `runner` (image app yang jalan terus) tetap jadi stage terakhir di file — jadi `docker build` tanpa `--target` masih hasilin image app seperti biasa, gak ada yang berubah dari sisi itu.

**2. `.github/workflows/deploy.yml`** — dua penambahan:

a) Build & push image migrator tambahan (job `build-and-push`), pakai `target: migrator`, tag `:latest-migrate` (testing) / `:production-migrate` (production). Karena cache layer sama dengan build image app, ini **gak nambah waktu build signifikan** — cuma reuse cache yang udah ada.

b) Di kedua job deploy (`deploy-testing` dan `deploy-production`), tambah satu baris setelah `docker compose up -d`:
```bash
docker run --rm --network onetone-store_onetone-net --env-file .env.app \
  ghcr.io/one2pret/onetone-store:latest-migrate    # atau :production-migrate
```
Container ini jalan sekali (`--rm` = auto-hapus abis selesai), connect ke DB lewat network yang sama dengan app + db (`onetone-store_onetone-net`, dari `docker compose`), baca `DATABASE_URL` dari `.env.app` yang sama dipakai app.

### Kenapa `--env-file .env.app` cukup (gak perlu clone/install lagi)

`drizzle.config.ts` baca `process.env.DATABASE_URL` langsung. Docker `--env-file` set environment variable itu pas container start, dan ini **override** nilai dummy `DATABASE_URL` yang di-bake pas build time (`ENV DATABASE_URL=$DATABASE_URL` dari stage `builder`, cuma dipakai buat keperluan `next build`, bukan buat drizzle). Jadi gak butuh langkah tambahan apapun di dalam container — tinggal jalan.

## Untuk kebutuhan apa

- **Kurangin human-error**: migrate gak lagi bisa "kelupaan" — otomatis jalan tiap push ke `main`/`production`.
- **Konsistensi versi**: image migrator dan image app di-build dari commit yang sama persis, gak ada risiko drift dari `git clone` terpisah saat migrate.
- **Lebih cepat**: gak ada `pnpm install` dari nol tiap migrate — reuse image yang udah jadi.
- **Gak perlu SSH manual** buat migrate lagi — cukup `git push`, CI yang urus semuanya (build image app, build image migrator, deploy app, jalanin migrate, cleanup).

## Verifikasi yang sudah dilakukan (sebelum push ke production/main)

1. `docker build --target migrator` — build sukses, reuse cache dari stage `builder`.
2. `docker run` image migrator dengan `DATABASE_URL` mengarah ke MySQL lokal (simulasi kondisi VPS lewat `host.docker.internal`) — hasil: `[✓] Pulling schema from database...` lalu `[✓] Changes applied`. Command jalan persis seperti yang akan dieksekusi `deploy.yml` di VPS asli.
3. Image test dihapus setelah verifikasi (`docker rmi`), tidak ada sisa di local Docker.

## Yang perlu diawasi di run pertama (setelah push)

- Run pertama di GitHub Actions: pastikan step "Build & Push migrator image" sukses dan step migrate di `deploy-testing`/`deploy-production` tidak error (cek log Actions).
- Kalau `docker run` gagal connect network: cek nama network aktual di VPS lewat `docker network ls` (harusnya `onetone-store_onetone-net` karena nama project Docker Compose diturunkan dari nama folder `onetone-store` — sama di kedua VPS testing & production meskipun beda host fisik).
- Kalau image gagal di-pull oleh `docker run`: pastikan VPS sudah `docker login ghcr.io` (biasanya sudah, karena `docker compose pull` sebelumnya sudah jalan tanpa masalah untuk image app).
