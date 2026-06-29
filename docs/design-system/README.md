# Onetone Design System

> Panduan master untuk UI/UX development Onetone Store.
> Semua keputusan visual mengacu pada dokumen ini — bukan intuisi, bukan tebakan.

---

## Daftar Dokumen

| # | Dokumen | Isi |
|---|---------|-----|
| 01 | [Color Tokens](./01-color-tokens.md) | Semua warna, dark & light theme |
| 02 | [Typography](./02-typography.md) | Font, ukuran, weight, line-height |
| 03 | [Spacing & Layout](./03-spacing-layout.md) | Grid, padding, margin, breakpoint |
| 04 | [Components](./04-components.md) | Panduan penggunaan setiap komponen UI |
| 05 | [Animation](./05-animation.md) | Kelas animasi dan panduan penggunaan |
| 06 | [AI Coding Rules](./06-ai-rules.md) | Aturan untuk Cline/LLM saat develop UI |

---

## Brand Identity

```
Nama Brand : Onetone
Karakter   : Premium · Dark · Elegan · Modern
Theme      : Dark (default) + Light (opsional)
Accent     : Gold / Amber (#C9A84C)
Tone       : Warm dark — bukan cold/blue dark
```

## Quick Reference

```css
/* 3 warna paling sering dipakai */
--primary:    #C9A84C   /* Gold — CTA, highlight, brand */
--background: #0A0A0A   /* Base background */
--foreground: #F5F0E8   /* Teks utama */
```

## Stack

- **Framework**: Next.js 16 App Router
- **Styling**: Tailwind CSS v4 + CSS Variables
- **UI Base**: shadcn/ui (New York style)
- **Icons**: Lucide React
- **Font**: Geist Sans + Geist Mono
