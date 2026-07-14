# 01 — Rebrand: Gold-Dark → White-Dark

> **Status:** Phase 0 — prasyarat, dikerjakan pertama.
> **Risiko:** Rendah. Arsitektur token mengisolasi perubahan.
> **Estimasi:** 2–4 jam (mekanis) + review visual.

---

## Prinsip Inti

Di sistem dark monokrom, **accent bukan warna — accent adalah inversi kontras.**

Gold dulu jadi accent karena beda hue dari teks (warm-white). Kalau primary diganti putih polos, primary dan foreground jadi kembar → hierarki kolaps. Solusinya: **primary = blok putih solid dengan teks gelap** (inversi). Ini pola Vercel / Linear / GitHub dark / Nothing.

Hierarki di sistem ini datang dari **brightness + fill inversion + weight**, bukan dari hue.

- **CTA / tombol utama** → `bg-primary` (putih) + `text-primary-foreground` (hitam). Blok putih penuh.
- **Harga / angka penting** → teks putih **bold** (bukan warna khusus). Kalau pakai Opsi B, boleh gold.
- **Nav aktif** → indikator putih (underline / left-bar / pill), bukan teks berwarna.
- **Badge** → outline style atau fill abu subtle. Badge premium/tier → gold (Opsi B).

---

## Keputusan yang Harus Dikonfirmasi Owner

- [ ] **Opsi A — Monokrom murni.** Putih + dark + abu saja. Paling clean, risiko terasa dingin & membership flat.
- [ ] **Opsi B — Monokrom + micro-accent gold (rekomendasi).** Primary putih untuk semua CTA/harga/nav. Gold dipertahankan HANYA untuk sinyal premium: badge tier membership, VIP, poin loyalty. ~1–2% permukaan.

Dokumen ini menyertakan token untuk **kedua opsi**; tinggal pilih.

---

## Token Baru — `app/globals.css`

### Dark Theme (`:root`) — default

```css
:root {
  /* Background layers — TIDAK BERUBAH (dark tetap dominan) */
  --background:         #0A0A0A;
  --card:               #141414;
  --surface:            #1E1E1E;
  --secondary:          #1C1C1C;
  --muted:              #1C1C1C;
  --popover:            #1C1C1C;

  /* Foreground — geser dari warm ke netral */
  --foreground:            #FAFAFA;   /* was #F5F0E8 (warm) */
  --card-foreground:       #FAFAFA;
  --secondary-foreground:  #FAFAFA;
  --surface-foreground:    #FAFAFA;
  --popover-foreground:    #FAFAFA;
  --muted-foreground:      #A1A1A1;   /* was #7A7468 (bronze) */

  /* Primary — WHITE (accent by inversion) */
  --primary:            #FFFFFF;   /* was #C9A84C */
  --primary-hover:      #E5E5E5;   /* was #E0BC6A */
  --primary-light:      #1A1A1A;   /* bg subtle: abu gelap, bukan tint terang */
  --primary-foreground: #0A0A0A;   /* teks gelap di atas tombol putih — kunci inversi */

  /* Accent area */
  --accent:             #1A1A1A;   /* was #1E1A10 (gold tint) */
  --accent-foreground:  #FAFAFA;   /* was #C9A84C */

  /* Border & Input — netral */
  --border:             #262626;   /* was #2A2520 (warm) */
  --input:              #1C1C1C;
  --ring:               #525252;   /* focus ring abu netral; #FFFFFF terlalu keras */

  /* Status colors — TIDAK BERUBAH (fungsional, bukan brand) */
  --destructive:        #EF4444;
  --success:            #22C55E;
  --warning:            #F59E0B;
  --danger:             #EF4444;

  /* === OPSI B saja: micro-accent premium === */
  --premium:            #C9A84C;   /* gold — HANYA badge tier/VIP/poin */
  --premium-foreground: #0A0A0A;

  --radius: 0.75rem;
}
```

### Tambahan mapping `@theme inline` (Opsi B saja)

```css
@theme inline {
  /* ...existing... */
  --color-premium:            var(--premium);
  --color-premium-foreground: var(--premium-foreground);
}
```

### Light Theme (`.light`) — sekunder, dark tetap default

```css
.light {
  --background:         #FFFFFF;
  --foreground:         #0A0A0A;
  --primary:            #0A0A0A;   /* inversi: di light, primary jadi hitam */
  --primary-hover:      #262626;
  --primary-light:      #F4F4F5;
  --primary-foreground: #FFFFFF;
  --card:               #FFFFFF;
  --card-foreground:    #0A0A0A;
  --surface:            #F4F4F5;
  --muted:              #F4F4F5;
  --muted-foreground:   #71717A;
  --accent:             #F4F4F5;
  --accent-foreground:  #0A0A0A;
  --border:             #E4E4E7;
  --input:              #E4E4E7;
  --ring:               #A1A1A1;
  /* Opsi B */
  --premium:            #B8922A;
  --premium-foreground: #FFFFFF;
}
```

---

## Titik yang Perlu Perhatian Manual (bukan auto)

Migrasi token otomatis mengurus 90%. Yang tersisa:

1. **`text-primary` untuk teks di atas dark.** Dulu gold (`text-primary`) untuk harga/link aktif tampil jelas. Sekarang `--primary` = putih = nyaris sama dengan foreground. **Fix:** ganti `text-primary` pada teks-di-atas-dark menjadi `font-semibold text-foreground` (harga/emphasis), atau `text-premium` (Opsi B). Ini keputusan per-kasus, bukan find-replace buta.

2. **Tombol `bg-primary text-primary-foreground`** → auto-benar. Primary putih + foreground hitam = tombol putih-teks-hitam. Tidak perlu diubah.

3. **Hardcoded hex gold.** Cari sisa `#C9A84C`, `#E0BC6A`, `#3D2E0E`, `#F5F0E8` yang di-inline. Termasuk `app/design-system/page.tsx` yang stale (juga masih ada referensi teal `#51B1A6` lama — bersihkan sekalian).

4. **Focus ring gold** (`--ring: #C9A84C`) → sudah diganti `#525252`. Cek kontras keyboard-nav masih kelihatan.

5. **Shadow gold glow** (`shadow-primary/20`). Glow putih di atas dark bisa terlihat aneh. Pertimbangkan hapus glow atau ganti jadi `shadow-black/40` biasa.

---

## Prompt Claude Code — siap paste

```
Kita rebrand design system dari gold-dark ke white-dark. Arsitektur sudah token-based
(app/globals.css pakai CSS variables + @theme inline), jadi ini terutama swap token.

TUGAS:
1. Update :root di app/globals.css dengan token white-dark sesuai
   docs/marketplace/01-rebrand-white-dark.md (bagian "Dark Theme").
   [Pilih: Opsi A monokrom murni / Opsi B + micro-accent gold] — pakai Opsi ___.
2. Update .light block sesuai dokumen yang sama.
3. Jika Opsi B: tambahkan mapping --color-premium & --color-premium-foreground
   di @theme inline.
4. Grep seluruh codebase untuk hardcoded hex: #C9A84C, #E0BC6A, #3D2E0E, #F5F0E8,
   #7A7468, #2A2520, dan sisa teal lama #51B1A6, #3D9A8F, #C5DDD9. Ganti ke token
   yang sesuai. Kecualikan file dokumentasi.
5. Audit semua penggunaan `text-primary` yang dipakai sebagai teks di atas background
   gelap (harga, link aktif, label). Ganti ke `font-semibold text-foreground`
   (default) atau `text-premium` (jika Opsi B & konteksnya premium/membership).
   JANGAN ubah `text-primary-foreground` — itu benar.
6. Bersihkan app/design-system/page.tsx: buang referensi warna lama, sinkronkan
   dengan token baru.
7. Ganti `shadow-primary/20` jadi shadow netral (`shadow-black/40`) di CTA.

VALIDASI:
- pnpm build → zero error
- Cek visual: tombol CTA = putih dengan teks hitam; harga = putih bold; tidak ada
  gold tersisa kecuali badge membership (Opsi B).
- Update docs/design-system/01-color-tokens.md & README.md ke nilai baru.

Tunjukkan diff globals.css dulu sebelum lanjut ke file lain.
```

---

## Checklist Validasi

- [ ] `pnpm build` zero error
- [ ] `pnpm vitest run` semua pass
- [ ] CTA button: putih solid, teks hitam, kebaca
- [ ] Harga produk: putih bold, jelas beda dari body text
- [ ] Nav aktif: indikator jelas tanpa hue
- [ ] Tidak ada gold tersisa (Opsi A) / gold hanya di badge membership (Opsi B)
- [ ] Focus ring kelihatan saat keyboard-nav
- [ ] Admin & POS ikut berubah otomatis, tidak ada regresi
- [ ] `docs/design-system/*` diperbarui ke nilai baru
