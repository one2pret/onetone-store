# Solved 2 — Search Bar Tidak Muncul di VPS

**Tanggal:** 2026-07-15
**Commit fix:** `07bc29a` (Dockerfile), `7f5b681` (deploy.yml), `101f4a9` (feature)

---

## Gejala

Search bar muncul di local dev (`localhost:3000`) tapi tidak muncul di production VPS (`onetone.kanuraga.web.id`). Layout production tetap menampilkan boutique wordmark (logo center) alih-alih layout search (logo kiri + search bar tengah + actions kanan).

## Root Cause Analysis

Masalah bertahap, tiga lapis:

### Lapis 1 — `NEXT_PUBLIC_*` di-bake saat build time

`NEXT_PUBLIC_SEARCH_ENABLED` dibaca via `process.env.NEXT_PUBLIC_SEARCH_ENABLED === 'true'` di `components/shop/Navbar.tsx`.

Next.js meng-inline nilai `NEXT_PUBLIC_*` ke bundled JS saat `pnpm build`, **bukan runtime**. Edit `.env` di server lalu `docker restart` = tidak ada efek. Bundled JS sudah jadi dengan nilai lama (`undefined` → `false`).

### Lapis 2 — Build arg tidak ter-declare di Dockerfile

`deploy.yml` sudah kirim build arg:
```yaml
build-args: |
  NEXT_PUBLIC_SEARCH_ENABLED=true
```

Tapi `Dockerfile` tidak declare `ARG NEXT_PUBLIC_SEARCH_ENABLED` dan `ENV NEXT_PUBLIC_SEARCH_ENABLED=...`. Docker Buildx abaikan build arg yang tidak declare. Value tidak sampai ke `RUN pnpm build`.

### Lapis 3 — Browser cache

Setelah image baru berhasil di-deploy (dengan fix Dockerfile), tampilan masih lama karena browser cache asset `.js` dan HTML. Hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) baru menampilkan versi baru.

## Fix

### File: `Dockerfile`

Tambahkan `ARG` dan `ENV` untuk setiap `NEXT_PUBLIC_*` yang di-declare di deploy.yml:

```dockerfile
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_GOOGLE_PICKER_API_KEY
ARG NEXT_PUBLIC_SEARCH_ENABLED
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=$NEXT_PUBLIC_GOOGLE_PICKER_API_KEY
ENV NEXT_PUBLIC_SEARCH_ENABLED=$NEXT_PUBLIC_SEARCH_ENABLED
```

### File: `.github/workflows/deploy.yml`

Sudah benar. Pastikan setiap `NEXT_PUBLIC_*` baru ditambah di `build-args`.

## Kesimpulan Aturan Umum

Setiap kali menambah env var `NEXT_PUBLIC_*` baru, wajib update **empat tempat**:

| # | File | Isi |
|---|---|---|
| 1 | `.env` (local) | `NEXT_PUBLIC_FOO=value` |
| 2 | `.github/workflows/deploy.yml` | `NEXT_PUBLIC_FOO=value` di `build-args` |
| 3 | `Dockerfile` | `ARG NEXT_PUBLIC_FOO` + `ENV NEXT_PUBLIC_FOO=$NEXT_PUBLIC_FOO` di stage builder |
| 4 | VPS `.env` (opsional) | `NEXT_PUBLIC_FOO=value` — **tidak wajib** karena sudah di-bake di image |

**Env var runtime biasa** (tanpa prefix `NEXT_PUBLIC_`) — cukup di `.env` VPS + `docker restart` karena dibaca di server side.

## Verifikasi Setelah Deploy

Di VPS setelah Actions selesai:

```bash
# Cek env var ter-bake di image
docker run --rm ghcr.io/one2pret/onetone-store:latest env | grep NEXT_PUBLIC_

# Cek digest image berubah
docker inspect ghcr.io/one2pret/onetone-store:latest --format='{{.Id}}'

# Force pull + recreate jika perlu
docker pull ghcr.io/one2pret/onetone-store:latest
docker compose -f /opt/onetone-store/docker-compose.yml up -d --force-recreate onetone-app
```

Di browser: **hard refresh** (`Cmd+Shift+R` / `Ctrl+Shift+R`).

## Debug Checklist Cepat

Jika `NEXT_PUBLIC_*` tidak berefek di production:

1. GitHub Actions untuk commit terakhir → success?
2. Digest image di VPS berubah setelah `docker pull`?
3. `docker run --rm <image> env | grep NEXT_PUBLIC_` menampilkan value yang benar?
4. Hard refresh browser?

Jika #3 gagal → cek Dockerfile ada `ARG` + `ENV`.
Jika #2 gagal → cek deploy.yml `build-args`.
Jika #1 gagal → cek CI logs.
Jika semua pass tapi tampilan lama → hard refresh browser.
