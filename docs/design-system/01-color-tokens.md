# 01 — Color Tokens

> Semua warna diakses via CSS variables. **Jangan pernah hardcode hex** langsung di komponen.
> Gunakan `bg-primary`, `text-foreground`, bukan `bg-[#C9A84C]` atau `text-[#F5F0E8]`.

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

### Brand Primary — Gold

Gold adalah **satu-satunya warna accent** Onetone. Gunakan dengan hemat — hanya untuk elemen yang perlu perhatian.

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--primary` | `bg-primary` / `text-primary` | `#C9A84C` | CTA button, harga, badge aktif |
| `--primary-hover` | `hover:bg-primary-hover` | `#E0BC6A` | Hover state button gold |
| `--primary-light` | `bg-primary-light` | `#3D2E0E` | Background subtle gold (badge bg) |
| `--primary-foreground` | `text-primary-foreground` | `#0A0A0A` | Teks di atas background gold |

---

### Foreground / Text

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--foreground` | `text-foreground` | `#F5F0E8` | Teks utama (warm white) |
| `--card-foreground` | `text-card-foreground` | `#F5F0E8` | Teks dalam card |
| `--muted-foreground` | `text-muted-foreground` | `#7A7468` | Placeholder, caption, label sekunder |
| `--secondary-foreground` | `text-secondary-foreground` | `#F5F0E8` | Teks di elemen secondary |
| `--accent-foreground` | `text-accent-foreground` | `#C9A84C` | Teks di area accent |

---

### Border & Input

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--border` | `border-border` | `#2A2520` | Border card, divider, garis |
| `--input` | `bg-input` | `#1C1C1C` | Background input field |
| `--ring` | `ring-ring` | `#C9A84C` | Focus ring (sama dengan primary) |

---

### Status Colors

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--success` | `text-success` / `bg-success` | `#22C55E` | Order sukses, stok tersedia |
| `--warning` | `text-warning` / `bg-warning` | `#F59E0B` | Stok menipis, peringatan |
| `--danger` | `text-danger` / `bg-danger` | `#EF4444` | Error, hapus, batalkan |
| `--destructive` | `bg-destructive` | `#EF4444` | Tombol destructive |

---

### Accent (Gold Subtle)

| Token CSS | Tailwind Class | Hex | Digunakan untuk |
|-----------|---------------|-----|------------------|
| `--accent` | `bg-accent` | `#1E1A10` | Hover row table, menu item hover |
| `--accent-foreground` | `text-accent-foreground` | `#C9A84C` | Teks di area accent |

---

## Light Theme (`.light` class)

Aktifkan dengan menambahkan `class="light"` pada `<html>` tag.

| Token | Dark Value | Light Value |
|-------|-----------|-------------|
| `--background` | `#0A0A0A` | `#FAFAF7` |
| `--foreground` | `#F5F0E8` | `#1A1714` |
| `--primary` | `#C9A84C` | `#B8922A` |
| `--primary-hover` | `#E0BC6A` | `#9A7520` |
| `--primary-light` | `#3D2E0E` | `#F5EDD3` |
| `--card` | `#141414` | `#FFFFFF` |
| `--surface` | `#1E1E1E` | `#F2EFE8` |
| `--border` | `#2A2520` | `#E2D9C8` |
| `--muted-foreground` | `#7A7468` | `#8A7D6B` |

---

## Cara Pakai di Komponen

```tsx
// ✅ BENAR — pakai token
<div className="bg-card border border-border rounded-xl">
  <h2 className="text-foreground font-semibold">Judul</h2>
  <p className="text-muted-foreground text-sm">Deskripsi</p>
  <span className="text-primary font-bold">Rp 150.000</span>
</div>

// ❌ SALAH — hardcode hex
<div className="bg-[#141414] border border-[#2A2520]">
  <span className="text-[#C9A84C]">Rp 150.000</span>
</div>
```

---

## Pola Warna yang Sering Dipakai

```tsx
// Gold badge
<span className="bg-primary-light text-primary border border-primary/20 rounded-md px-2 py-0.5 text-xs">
  Terlaris
</span>

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
                  focus:ring-2 focus:ring-ring/50 focus:border-primary rounded-lg" />
```
