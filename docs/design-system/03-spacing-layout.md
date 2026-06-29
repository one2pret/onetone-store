# 03 — Spacing & Layout

> Onetone menggunakan **4px grid system** dari Tailwind. Semua spacing kelipatan 4px.

---

## Spacing Scale

| Tailwind | px | Digunakan untuk |
|----------|----|-----------------|
| `p-1` / `m-1` | 4px | Gap icon dalam button, spacing micro |
| `p-2` / `m-2` | 8px | Padding badge, gap kecil |
| `p-3` / `m-3` | 12px | Padding button sm, gap list item |
| `p-4` / `m-4` | 16px | Padding card, section gap standard |
| `p-5` / `m-5` | 20px | Padding section kecil |
| `p-6` / `m-6` | 24px | Padding card besar, section heading gap |
| `p-8` / `m-8` | 32px | Padding page section |
| `p-12` / `m-12` | 48px | Gap antar section besar |
| `p-16` / `m-16` | 64px | Hero padding |

---

## Border Radius

Onetone menggunakan `--radius: 0.75rem` (12px) sebagai base.

| Token | Class Tailwind | Value | Digunakan untuk |
|-------|----------------|-------|-----------------|
| `--radius-sm` | `rounded-sm` | 8px | Badge, chip kecil |
| `--radius-md` | `rounded-md` | 10px | Button, input |
| `--radius-lg` | `rounded-lg` | 12px | Card standard |
| `--radius-xl` | `rounded-xl` | 16px | Card besar, modal |
| — | `rounded-full` | 9999px | Avatar, pill badge |

```tsx
// Contoh penggunaan radius yang benar:
<div className="rounded-xl">Card produk</div>
<button className="rounded-md">Tombol</button>
<span className="rounded-full">Avatar / Pill</span>
<input className="rounded-md" />
```

---

## Breakpoints (Responsive)

Mobile-first — selalu mulai dari mobile, tambah prefix untuk layar lebih besar.

| Prefix | Min-width | Device |
|--------|-----------|--------|
| (none) | 0px | Mobile |
| `sm:` | 640px | Mobile landscape / small tablet |
| `md:` | 768px | Tablet |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Desktop besar |
| `2xl:` | 1536px | Wide screen |

```tsx
// Contoh grid responsive:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {products.map(p => <ProductCard key={p.id} {...p} />)}
</div>
```

---

## Layout Structure

### Shop Layout
```
┌─────────────────────────────────────┐
│  Navbar  (sticky top, h-16)         │
├─────────────────────────────────────┤
│                                     │
│  Main Content                       │
│  max-w-7xl mx-auto px-4 sm:px-6     │
│                                     │
├─────────────────────────────────────┤
│  Footer                             │
└─────────────────────────────────────┘
```

### Admin Layout
```
┌──────────┬──────────────────────────┐
│          │  Admin Header (h-16)     │
│ Sidebar  ├──────────────────────────┤
│ (w-64)   │                          │
│          │  Page Content            │
│          │  p-6                     │
│          │                          │
└──────────┴──────────────────────────┘
```

---

## Container Standard

```tsx
// Wrapper konten halaman shop:
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

// Section dengan padding vertikal:
<section className="py-8 md:py-12">

// Card grid produk:
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

// Admin content area:
<div className="p-4 md:p-6">
```

---

## Shadow

| Class | Digunakan untuk |
|-------|-----------------|
| `shadow-sm` | Card subtle |
| `shadow-md` | Dropdown, popover |
| `shadow-lg` | Modal, drawer |
| `shadow-primary/10` | Card hover dengan gold glow |
| `shadow-primary/20` | Button gold focus glow |

```tsx
// Card dengan gold glow saat hover:
<div className="shadow-sm hover:shadow-lg hover:shadow-primary/10 transition-shadow">
```
