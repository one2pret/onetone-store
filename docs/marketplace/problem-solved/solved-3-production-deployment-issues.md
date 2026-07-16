# Solved 3 — Production Deployment Issues (2026-07-15)

Rangkuman semua masalah yang ditemukan dan diselesaikan dalam satu sesi deployment ke VPS.

---

## Masalah 1 — Search Bar Tidak Muncul di Production

### Gejala
Search bar tampil di `localhost:3000` tapi tidak muncul di `https://onetone.kanuraga.web.id`.

### Root Cause (3 lapis)

**Lapis 1 — `NEXT_PUBLIC_*` di-bake saat build time**

Next.js meng-inline nilai `NEXT_PUBLIC_*` ke bundled JS saat `pnpm build`, bukan saat runtime. Edit `.env` di server + `docker restart` = tidak ada efek.

**Lapis 2 — `ARG`/`ENV` tidak ter-declare di Dockerfile**

`deploy.yml` sudah kirim build-arg `NEXT_PUBLIC_SEARCH_ENABLED=true` tapi `Dockerfile` tidak punya:
```dockerfile
ARG NEXT_PUBLIC_SEARCH_ENABLED
ENV NEXT_PUBLIC_SEARCH_ENABLED=$NEXT_PUBLIC_SEARCH_ENABLED
```
Docker Buildx abaikan build-arg yang tidak di-declare. Value tidak sampai ke `pnpm build`.

**Lapis 3 — Browser cache**

Setelah image baru berhasil di-deploy, browser masih serve asset lama dari cache.

### Fix

1. Tambah `ARG` + `ENV` di `Dockerfile` (commit `07bc29a`)
2. Tunggu GitHub Actions rebuild image
3. VPS auto-update via SSH step di workflow
4. **Hard refresh browser** (`Cmd+Shift+R` / `Ctrl+Shift+R`)

### Aturan — Setiap `NEXT_PUBLIC_*` baru wajib update 3 tempat

| File | Yang ditambahkan |
|---|---|
| `.env` (local) | `NEXT_PUBLIC_FOO=value` |
| `.github/workflows/deploy.yml` → `build-args` | `NEXT_PUBLIC_FOO=value` |
| `Dockerfile` (stage builder) | `ARG NEXT_PUBLIC_FOO` + `ENV NEXT_PUBLIC_FOO=$NEXT_PUBLIC_FOO` |

> `.env` di VPS **tidak perlu** untuk `NEXT_PUBLIC_*` — sudah di-bake di image.

---

## Masalah 2 — `/stores/onetone` Error 500 di Production

### Gejala
Route `/stores/onetone` accessible di local, tapi error di production:
```
Error: Table 'onetone_db.stores' doesn't exist
```

### Root Cause
Schema database production belum di-migrate (`pnpm db:push` belum pernah dijalankan ke production DB). Tabel `stores`, `products`, dll tidak ada di `onetone_db`.

### Tambahan — `drizzle-kit` tidak tersedia di production image

Image production adalah Next.js standalone build — `node_modules` tidak disertakan. `drizzle-kit` tidak bisa dijalankan dari dalam container `onetone-app`.

---

## Masalah 3 — Migration Gagal: FK Constraint

### Gejala
Saat `pnpm db:push` dijalankan, drizzle menemukan `store_id` perlu diubah dari `varchar(36)` → `int`. Drizzle coba truncate tabel tapi gagal:
```
Cannot truncate a table referenced in a foreign key constraint
(`onetone_db`.`invoices`, CONSTRAINT `invoices_order_id_orders_id_fk`)
```

### Fix
Disable FK checks di MySQL, truncate manual, baru push:

```sql
-- Masuk ke MySQL container
docker exec -it onetone-db mysql -u onetone_user -padminpwd_070585 onetone_db

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE invoices;
TRUNCATE TABLE orders;
TRUNCATE TABLE order_items;
TRUNCATE TABLE products;
SET FOREIGN_KEY_CHECKS = 1;
EXIT;
```

---

## Solusi Lengkap — Database Migration + Seed di Production

Karena production image tidak punya `node_modules`, cara terbaik: spin up container Node sementara yang join ke network Docker yang sama dengan DB.

### Step 1 — Truncate tabel bermasalah (jika ada data lama)

```bash
docker exec -it onetone-db mysql -u onetone_user -padminpwd_070585 onetone_db
```

```sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE invoices;
TRUNCATE TABLE orders;
TRUNCATE TABLE order_items;
TRUNCATE TABLE products;
SET FOREIGN_KEY_CHECKS = 1;
EXIT;
```

### Step 2 — Push schema

```bash
docker run --rm -it \
  --network onetone-store_onetone-net \
  -e DATABASE_URL="mysql://onetone_user:adminpwd_070585@onetone-db:3306/onetone_db" \
  node:20-alpine \
  sh -c "apk add --no-cache git && \
    git clone https://github.com/one2pret/onetone-store.git /app && \
    cd /app && \
    npm install -g pnpm && \
    pnpm install && \
    pnpm db:push --force"
```

### Step 3 — Seed data awal

```bash
docker run --rm \
  --network onetone-store_onetone-net \
  node:20-alpine \
  sh -c "apk add --no-cache git && \
    git clone https://github.com/one2pret/onetone-store.git /app && \
    cd /app && \
    echo 'DATABASE_URL=mysql://onetone_user:adminpwd_070585@onetone-db:3306/onetone_db' > .env && \
    npm install -g pnpm && \
    pnpm install && \
    pnpm db:seed"
```

> **Catatan:** Seed script menggunakan `tsx --env-file=.env` sehingga file `.env` harus dibuat manual di dalam container sebelum dijalankan. `DATABASE_URL` via `-e` flag saja tidak cukup.

---

## Rekomendasi Jangka Panjang

### Tambahkan migration step ke CI/CD

Saat ini tidak ada otomasi migration. Setiap schema change perlu dijalankan manual. Solusi ideal: tambahkan step di `deploy.yml` setelah container up untuk menjalankan migration via container sementara.

```yaml
- name: Run DB migration
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.VPS_HOST }}
    username: ${{ secrets.VPS_USER }}
    key: ${{ secrets.VPS_SSH_KEY }}
    script: |
      docker run --rm \
        --network onetone-store_onetone-net \
        -e DATABASE_URL="${{ secrets.DATABASE_URL }}" \
        node:20-alpine \
        sh -c "apk add --no-cache git && \
          git clone https://github.com/one2pret/onetone-store.git /app && \
          cd /app && npm install -g pnpm && pnpm install && \
          pnpm db:push --force"
```

### Verifikasi post-deploy checklist

```bash
# 1. Cek env var ter-bake di image
docker run --rm ghcr.io/one2pret/onetone-store:latest env | grep NEXT_PUBLIC_

# 2. Cek tabel ada di DB
docker exec -it onetone-db mysql -u onetone_user -padminpwd_070585 onetone_db -e "SHOW TABLES;"

# 3. Cek store ada dan aktif
docker exec -it onetone-db mysql -u onetone_user -padminpwd_070585 onetone_db \
  -e "SELECT slug, is_active FROM stores;"

# 4. Cek app logs
docker logs onetone-app --tail=20
```
