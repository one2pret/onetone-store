# 05 — Animation

> Animasi Onetone bersifat **subtle dan purposeful** — ada alasan setiap elemen bergerak.
> Prinsip: animate **meaning**, bukan sekadar dekorasi.

---

## Utility Classes (dari `globals.css`)

### `animate-fadeIn`
```css
/* Opacity 0 → 1, durasi 0.3s */
```
**Digunakan**: Page transition, modal appear, toast notification.
```tsx
<div className="animate-fadeIn">
  {/* Konten yang baru muncul */}
</div>
```

---

### `animate-fadeInUp`
```css
/* Opacity 0 + translateY(16px) → opacity 1 + translateY(0), durasi 0.5s */
```
**Digunakan**: Card list masuk, hero section, produk saat filter berubah.
```tsx
// Staggered list:
{products.map((p, i) => (
  <div
    key={p.id}
    className="animate-fadeInUp"
    style={{ animationDelay: `${i * 0.05}s` }}
  >
    <ProductCard {...p} />
  </div>
))}
```

---

### `animate-float`
```css
/* Naik-turun 10px, cycle 4s, infinite */
```
**Digunakan**: Ilustrasi hero, ikon dekoratif, empty state illustration.
```tsx
<img src="/hero-product.png" className="animate-float" />
```

### `animate-float-delayed`
```css
/* Sama dengan float tapi delay 1s — untuk elemen pendamping */
```
```tsx
<div className="flex gap-8">
  <img className="animate-float" src="/product-1.png" />
  <img className="animate-float-delayed" src="/product-2.png" />
</div>
```

---

### `animate-gold-shimmer` ⭐
```css
/* Gradient gold bergerak horizontal — efek premium/metalik */
```
**Digunakan**: Logo brand, label premium, heading hero, nama toko.

> ⚠️ Hanya untuk text — membutuhkan `-webkit-background-clip: text`.
> Jangan gunakan di background element biasa.

```tsx
// Logo teks brand:
<span className="animate-gold-shimmer font-bold text-2xl">
  Onetone
</span>

// Label premium:
<span className="animate-gold-shimmer font-semibold text-sm">
  ✦ Premium Collection
</span>
```

---

## Tailwind Transition Standard

Selain custom animation, gunakan Tailwind transition untuk interaksi biasa:

```tsx
// Hover color change:
<a className="text-muted-foreground hover:text-primary transition-colors duration-200">

// Card hover border + shadow:
<div className="border-border hover:border-primary/40
               shadow-sm hover:shadow-primary/10
               transition-all duration-200">

// Button press:
<button className="active:scale-[0.98] transition-transform">

// Image zoom on card hover:
<div className="group overflow-hidden">
  <img className="group-hover:scale-105 transition-transform duration-300" />
</div>

// Opacity reveal:
<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
```

---

## Aturan Animasi

| ✅ Boleh | ❌ Hindari |
|----------|----------|
| fadeIn untuk konten baru muncul | Animasi pada teks body panjang |
| Hover transition pada card & button | Bounce/spin tanpa tujuan |
| Gold shimmer untuk nama brand | shimmer di seluruh halaman |
| Float untuk ilustrasi hero | Float pada elemen interaktif |
| Stagger fadeInUp untuk list produk | Durasi > 0.6s untuk UI element |
