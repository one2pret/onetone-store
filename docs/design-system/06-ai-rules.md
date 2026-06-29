# 06 — AI Coding Rules untuk UI Development

> Dokumen ini adalah **briefing wajib** untuk Cline, Claude, atau LLM apapun
> sebelum mengerjakan task UI di project Onetone Store.
> Copy-paste isi dokumen ini sebagai context awal setiap sesi.

---

## Stack yang TIDAK BOLEH DIGANTI

```
- Next.js 16 (App Router, Server Components)
- Tailwind CSS v4 + CSS Variables (bukan Tailwind v3 config)
- shadcn/ui New York style (bukan Default style)
- pnpm v10+ — konfigurasi di pnpm-workspace.yaml
- Font: Geist Sans + Geist Mono (dari next/font/google)
- Icons: Lucide React SAJA
```

---

## Token System — WAJIB PAKAI

```
Semua warna HARUS menggunakan CSS variable token:

bg-background     → halaman utama (#0A0A0A dark)
bg-card           → card, panel (#141414 dark)
bg-surface        → sidebar, drawer (#1E1E1E dark)
bg-secondary      → elemen secondary (#1C1C1C dark)
bg-muted          → skeleton, disabled (#1C1C1C dark)
bg-input          → input field (#1C1C1C dark)

text-foreground   → teks utama (#F5F0E8 warm white)
text-muted-foreground → caption, placeholder (#7A7468)
text-primary      → gold accent (#C9A84C)
bg-primary        → gold button background
text-primary-foreground → teks di atas gold (#0A0A0A)

border-border     → semua garis border (#2A2520)
ring-ring         → focus ring (#C9A84C)
```

---

## ⛔ DILARANG KERAS

```
1. Hardcode hex color di className — bg-[#C9A84C] ❌
2. Pakai text-white — selalu text-foreground ✅
3. Pakai bg-white atau bg-gray-* — selalu bg-card / bg-surface ✅
4. Tambah dependency baru tanpa konfirmasi user
5. Ubah pnpm-workspace.yaml
6. Ubah lib/auth.ts atau lib/db/schema.ts tanpa izin
7. Gunakan <img> biasa untuk produk — harus next/image ✅
8. Ubah lebih dari 3 file dalam satu task
9. Hapus CSS variable yang sudah ada di globals.css
10. Pakai dark: prefix Tailwind — kita sudah handle via :root
```

---

## Prosedur Wajib Sebelum Coding

```
Sebelum mengerjakan APAPUN, LLM harus:

1. DECLARE: "File yang akan saya ubah:"
   - [list file eksplisit]

2. DECLARE: "File yang TIDAK akan saya sentuh:"
   - [list file yang aman]

3. TANYA kalau ada dependency baru yang dibutuhkan

4. EKSEKUSI hanya setelah user konfirmasi
```

---

## Pola Komponen yang Benar

```tsx
// ✅ Card standard Onetone
<div className="bg-card border border-border rounded-xl p-4
               hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10
               transition-all duration-200">

// ✅ Harga produk
<span className="text-primary font-bold text-lg">
  {formatRupiah(price)}
</span>

// ✅ Badge status order
<Badge variant="success">Terkirim</Badge>
<Badge variant="warning">Dikemas</Badge>
<Badge variant="danger">Dibatalkan</Badge>
<Badge variant="gold">Terlaris</Badge>

// ✅ Tombol CTA utama
<Button>Beli Sekarang</Button>

// ✅ Tombol sekunder
<Button variant="outline">Lihat Detail</Button>

// ✅ Input dengan label
<div className="space-y-1.5">
  <Label htmlFor="x">Label</Label>
  <Input id="x" placeholder="..." />
</div>
```

---

## Cara Tambah Komponen shadcn Baru

```bash
# SELALU pakai pnpm dlx, BUKAN npx
pnpm dlx shadcn@latest add [nama-komponen]

# Contoh:
pnpm dlx shadcn@latest add sheet
pnpm dlx shadcn@latest add tooltip
pnpm dlx shadcn@latest add skeleton
```

Setelah install, komponen otomatis mengikuti token Onetone karena sudah di-setup di `globals.css`.

---

## Checklist Review UI Sebelum Commit

```
- [ ] Tidak ada background putih / light yang nyasar di dark page
- [ ] Harga selalu text-primary (gold)
- [ ] Card selalu bg-card dengan border-border
- [ ] Input selalu bg-input dengan focus ring gold
- [ ] Tombol CTA pakai variant default (gold)
- [ ] Tidak ada hardcode hex color
- [ ] Gambar produk pakai next/image
- [ ] Responsive: dicek di mobile (< 640px) dan desktop (> 1024px)
- [ ] Tidak ada TypeScript error
- [ ] Tidak ada console.error di browser
```
