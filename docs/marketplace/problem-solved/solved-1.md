Site sudah online. Ini rangkuman lengkap sesi hari ini:

---

## Rangkuman Sesi — Onetone Store Marketplace Evolution

### 1. Arah Besar yang Disepakati

**Onetone Store → Marketplace** dengan model:
- URL utama `onetone-store.id` = tampilan marketplace (pola UX Shopee)
- Boutique Onetone sekarang = toko resmi pertama di dalam marketplace
- Membership dengan diskon, gratis ongkir, poin loyalty
- Tab "Saya" ala marketplace untuk customer
- PPOB dan multi-seller → deferred, tidak di MVP

Dokumen siap commit: `docs/marketplace/00-master-plan.md` + `docs/marketplace/01-rebrand-white-dark.md`

---

### 2. Keputusan Warna: Gold → White-Dark

**Kondisi sekarang:** `--primary: #C9A84C` (gold)

**Arah baru:** White-dark monokrom — dark tetap dominan, accent by inversion (tombol putih + teks hitam)

**Dua opsi, belum dikunci:**
- **Opsi A** — monokrom murni, putih + dark + abu saja
- **Opsi B** (rekomendasi) — putih untuk CTA/harga/nav, gold `#C9A84C` dipertahankan khusus badge membership/tier/VIP

**Kenapa mudah dieksekusi:** Arsitektur sudah token-based di `globals.css` → ganti ~15 baris, semua komponen ikut otomatis.

---

### 3. Rencana Fase Eksekusi

| Fase | Isi | Status |
|------|-----|--------|
| **0** | Rebrand gold → white-dark | Prompt siap, belum eksekusi |
| **1** | Data model: stores, memberships, points, vouchers | Schema draft siap di doc |
| **2** | Marketplace shell + routing refactor | Planned |
| **3** | Account area "Saya" | Planned |
| **4** | Membership di checkout | Planned |
| **5+** | PPOB, multi-seller penuh | Deferred |

---

### 4. Insiden Production — store_id

**Apa yang terjadi:**
Claude Code menambahkan `store_id` ke Drizzle schema → push ke main → CI/CD deploy → MySQL belum punya kolom → site mati dengan error `Unknown column 'products.store_id'`

**Fix:**
```sql
USE onetone_db;
ALTER TABLE products ADD COLUMN store_id VARCHAR(36) NULL AFTER id;
ALTER TABLE orders ADD COLUMN store_id VARCHAR(36) NULL AFTER id;
```
Lalu `docker restart onetone-app` → online kembali.

**Kenapa drizzle-kit push gagal via container:** `drizzle.config.ts` tidak ikut di-copy ke Docker image production.

---

### 5. SOP Wajib — Setiap Schema Berubah

```
1. Edit schema.ts di lokal
2. pnpm build → pastikan zero error
3. Jalankan ALTER TABLE di VPS dulu via:
   docker exec -it onetone-db mysql -u root -p
4. Baru git push → CI/CD deploy
```

---
