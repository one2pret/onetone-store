# 01 — Color Tokens

> Semua warna diakses via CSS variables. **Jangan pernah hardcode hex** langsung di komponen.
> Gunakan `bg-primary`, `text-foreground`, bukan `bg-[#FFFFFF]` atau `text-[#FAFAFA]`.

**Sistem aktif: White-Dark Monokrom + Micro-Gold Premium (Opsi B)**
Accent bukan warna — accent adalah inversi kontras. Primary = blok putih solid dengan teks gelap.

---

## Dark Theme (Default — `:root`)

### Background Layers

Onetone pakai sistem **layered background** — bukan satu warna flat.
Makin dalam/terdepan elemennya, makin terang backgroundnya (subtle).

```
Level 0  →  #0A0A0A  (--background)   Base page
Level 1  →  #141414  (--card)         Card, panel
Level 2  →  #1C1C1C  (--secondary)    Secondary element
Level 3  →  #1E1E1E  (--surface)      Sidebar, drawer, modal bg
Level 4  →  #1C1C1C  (--popover)      Dropdown, tooltip
```

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--background` | `bg-background` | `#0A0A0A` | Background halaman utama |
| `--card` | `bg-card` | `#141414` | Card produk, panel |
| `--surface` | `bg-surface` | `#1E1E1E` | Sidebar, drawer |
| `--secondary` | `bg-secondary` | `#1C1C1C` | Elemen sekunder |
| `--muted` | `bg-muted` | `#1C1C1C` | Skeleton, disabled area |
| `--popover` | `bg-popover` | `#1C1C1C` | Dropdown, tooltip |

---

### Brand Primary — WHITE (Inversi Kontras)

Primary adalah **blok putih solid** — accent by inversion (pola Vercel / Linear / GitHub dark).
Hierarki datang dari brightness + fill inversion + weight, bukan dari hue.

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--primary` | `bg-primary` / `text-primary` | `#FFFFFF` | CTA button, nav aktif, indikator |
| `--primary-hover` | `hover:bg-primary-hover` | `#E5E5E5` | Hover state button putih |
| `--primary-light` | `bg-primary-light` | `#1A1A1A` | Background subtle abu gelap |
| `--primary-foreground` | `text-primary-foreground` | `#0A0A0A` | Teks gelap di atas tombol putih |

> **Catatan penting:** `text-primary` di atas background gelap = putih ≈ sama dengan `text-foreground`.
> Untuk teks emphasis (harga, label aktif), pakai `font-semibold text-foreground` bukan `text-primary`.
> `bg-primary text-primary-foreground` = tombol putih + teks hitam. Hierarki dari kontras, bukan warna.

---

### Premium Micro-Accent — GOLD (Opsi B)

Gold dipertahankan **hanya** untuk sinyal premium: badge tier membership, VIP, poin loyalty.
~1–2% permukaan. Jangan dipakai sebagai brand color umum.

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--premium` | `bg-premium` / `text-premium` | `#C9A84C` | Badge tier/VIP/poin loyalty |
| `--premium-foreground` | `text-premium-foreground` | `#0A0A0A` | Teks di atas badge premium |

---

### Foreground / Text

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--foreground` | `text-foreground` | `#FAFAFA` | Teks utama (netral white) |
| `--card-foreground` | `text-card-foreground` | `#FAFAFA` | Teks dalam card |
| `--muted-foreground` | `text-muted-foreground` | `#A1A1A1` | Placeholder, caption, label sekunder |
| `--secondary-foreground` | `text-secondary-foreground` | `#FAFAFA` | Teks di elemen secondary |
| `--accent-foreground` | `text-accent-foreground` | `#FAFAFA` | Teks di area accent |

---

### Border & Input

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--border` | `border-border` | `#262626` | Border card, divider, garis |
| `--input` | `bg-input` | `#1C1C1C` | Background input field |
| `--ring` | `ring-ring` | `#525252` | Focus ring abu netral |

---

### Accent

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--accent` | `bg-accent` | `#1A1A1A` | Hover row table, menu item hover |
| `--accent-foreground` | `text-accent-foreground` | `#FAFAFA` | Teks di area accent |

---

### Status Colors

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--success` | `text-success` / `bg-success` | `#22C55E` | Order sukses, stok tersedia |
| `--warning` | `text-warning` / `bg-warning` | `#F59E0B` | Stok menipis, peringatan |
| `--danger` | `text-danger` / `bg-danger` | `#EF4444` | Error, hapus, batalkan |
| `--destructive` | `bg-destructive` | `#EF4444` | Tombol destructive |

---

## Light Theme (`.light` class)

Aktifkan dengan menambahkan `class="light"` pada `<html>` tag.
Di light mode, primary **diinversi menjadi hitam** — pola yang sama, kontras yang sama.

| Token | Dark Value | Light Value |
|-------|-----------|-------------|
| `--background` | `#0A0A0A` | `#FFFFFF` |
| `--foreground` | `#FAFAFA` | `#0A0A0A` |
| `--primary` | `#FFFFFF` | `#0A0A0A` |
| `--primary-hover` | `#E5E5E5` | `#262626` |
| `--primary-light` | `#1A1A1A` | `#F4F4F5` |
| `--primary-foreground` | `#0A0A0A` | `#FFFFFF` |
| `--card` | `#141414` | `#FFFFFF` |
| `--surface` | `#1E1E1E` | `#F4F4F5` |
| `--muted` | `#1C1C1C` | `#F4F4F5` |
| `--muted-foreground` | `#A1A1A1` | `#71717A` |
| `--border` | `#262626` | `#E4E4E7` |
| `--input` | `#1C1C1C` | `#E4E4E7` |
| `--ring` | `#525252` | `#A1A1A1` |
| `--premium` | `#C9A84C` | `#B8922A` |
| `--premium-foreground` | `#0A0A0A` | `#FFFFFF` |

---

## Cara Pakai di Komponen

```tsx
// ✅ BENAR — pakai token
<div className="bg-card border border-border rounded-xl">
  <h2 className="text-foreground font-semibold">Judul</h2>
  <p className="text-muted-foreground text-sm">Deskripsi</p>
  <span className="font-bold text-foreground">Rp 150.000</span>
</div>

// ✅ CTA button — putih (dark) / hitam (light), teks inversi
<button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg">
  Beli Sekarang
</button>

// ✅ Premium badge (Opsi B)
<span className="bg-premium text-premium-foreground text-xs font-medium px-2 py-0.5 rounded-full">
  VIP Member
</span>

// ❌ SALAH — hardcode hex
<div className="bg-[#141414] border border-[#262626]">
  <span className="text-[#FFFFFF]">Rp 150.000</span>
</div>
```

---

## Pola Warna yang Sering Dipakai

```tsx
// Status badge sukses
<span className="bg-success/10 text-success rounded-md px-2 py-0.5 text-xs">
  Terkirim
</span>

// Card standard
<div className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors">
  ...
</div>

// Input standard
<input className="bg-input border border-border text-foreground placeholder:text-muted-foreground
                  focus:ring-2 focus:ring-ring focus:border-primary rounded-lg" />

// Nav item aktif — indikator putih (underline / pill)
<div className="border-b-2 border-primary text-foreground font-semibold">
  Dashboard
</div>

// Harga produk — bold foreground, BUKAN text-primary
<span className="text-lg font-bold text-foreground">Rp 350.000</span>
```
