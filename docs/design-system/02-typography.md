# 02 — Typography

> Font sistem Onetone menggunakan **Geist** dari Vercel — modern, clean, sangat readable di dark background.

---

## Font Family

| Variable | Font | Digunakan untuk |
|----------|------|-----------------|
| `--font-sans` / `font-sans` | Geist Sans | Semua teks UI, body, heading |
| `--font-mono` / `font-mono` | Geist Mono | Kode, order number, invoice ID |

### Setup di `layout.tsx`

```tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tambahkan ke body className:
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
```

---

## Type Scale

Menggunakan skala Tailwind standar dengan konvensi penggunaan:

| Class Tailwind | Size | Digunakan untuk |
|----------------|------|------------------|
| `text-xs` | 12px | Caption, label kecil, badge |
| `text-sm` | 14px | Body kecil, form label, subtitle |
| `text-base` | 16px | Body text utama |
| `text-lg` | 18px | Sub-heading, card title |
| `text-xl` | 20px | Section heading kecil |
| `text-2xl` | 24px | Heading section utama |
| `text-3xl` | 30px | Page title |
| `text-4xl+` | 36px+ | Hero heading |

---

## Font Weight

| Class | Weight | Digunakan untuk |
|-------|--------|-----------------|
| `font-normal` | 400 | Body text biasa |
| `font-medium` | 500 | Label, nav item |
| `font-semibold` | 600 | Card title, sub-heading |
| `font-bold` | 700 | Harga, CTA label, page title |
| `font-extrabold` | 800 | Hero heading |

---

## Pola Typography yang Baku

```tsx
// Harga produk
<span className="text-primary font-bold text-lg">
  Rp 1.250.000
</span>

// Nama produk (card)
<h3 className="text-foreground font-semibold text-sm line-clamp-2">
  iPhone 15 Pro Max 256GB Natural Titanium
</h3>

// Caption / deskripsi sekunder
<p className="text-muted-foreground text-xs">
  Stok: 24 unit
</p>

// Page title
<h1 className="text-foreground font-bold text-2xl">
  Semua Produk
</h1>

// Section heading
<h2 className="text-foreground font-semibold text-xl">
  Produk Terlaris
</h2>

// Order number (mono)
<span className="font-mono text-sm text-muted-foreground">
  #ORD-20240627-001
</span>

// Gold shimmer untuk brand text
<span className="animate-gold-shimmer font-bold text-2xl">
  Onetone
</span>
```

---

## Line Height & Tracking

```tsx
// Body text — default leading sudah bagus
<p className="text-sm leading-relaxed text-foreground">

// Heading — lebih tight
<h1 className="text-3xl font-bold leading-tight tracking-tight">

// Badge/label — compact
<span className="text-xs leading-none">
```

---

## Anti-pattern yang Harus Dihindari

```tsx
// ❌ Jangan pakai warna putih murni — pakai foreground
<p className="text-white">...</p>
// ✅
<p className="text-foreground">...</p>

// ❌ Jangan hardcode ukuran font
<p style={{ fontSize: '13px' }}>...</p>
// ✅
<p className="text-sm">...</p>

// ❌ Teks terlalu banyak bold
<p className="font-bold">Semua teks ini bold</p>
// ✅ Bold hanya untuk emphasis penting
```
