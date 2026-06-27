# Sesi 01 — Setup Project Next.js 16

> ⏱️ Estimasi: 30 menit
> 🎯 Tujuan: Peserta punya project Next.js 16 yang running di `localhost:3000` dengan semua dependency siap.

---

## 1. Konsep Singkat (5 menit)

### Apa itu Next.js?
- Framework React untuk full-stack web app
- **App Router** (Next.js 13+): folder = route. File `page.tsx` = halaman.
- **Server Components by default** — render di server, lebih cepat, SEO-friendly
- **Server Actions** — function backend yang bisa dipanggil langsung dari component

### Kenapa Next.js 16?
- Turbopack stable (dev server jauh lebih cepat dari Webpack)
- React 19 support
- Server Components matang

---

## 2. Buat Project Baru

```bash
# Bikin di folder Documents/Projects atau dimana saja
pnpm create next-app@latest next-olshop

# Pilih opsi berikut:
# ✔ Would you like to use TypeScript?         → Yes
# ✔ Would you like to use ESLint?             → Yes
# ✔ Would you like to use Tailwind CSS?       → Yes
# ✔ Would you like your code inside a `src/`? → No
# ✔ Would you like to use App Router?         → Yes
# ✔ Would you like to use Turbopack?          → Yes
# ✔ Would you like to customize import alias? → No (default @/*)

cd next-olshop
pnpm dev
```

✅ **Checkpoint**: buka `http://localhost:3000` — harus tampil welcome page Next.js.

---

## 3. Bersihkan Project Awal

### Hapus File Default
```bash
# Hapus folder/file yang ga dipakai
rm -rf public/*
```

### Edit `app/page.tsx`
Ganti isinya jadi:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-bold">Next Olshop 🛍️</h1>
    </main>
  );
}
```

### Edit `app/layout.tsx`
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next Olshop",
  description: "Online Shop untuk UMKM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

### Bersihkan `app/globals.css`
```css
@import "tailwindcss";

@theme {
  --color-primary: #51B1A6;
  --color-primary-hover: #3D9A8F;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

✅ **Checkpoint**: refresh browser → harus tampil "Next Olshop 🛍️" di tengah layar.

---

## 4. Install Dependencies

Pasang library yang akan dipakai sepanjang course:

```bash
# Database & ORM
pnpm add drizzle-orm mysql2
pnpm add -D drizzle-kit

# Auth
pnpm add next-auth@beta bcryptjs
pnpm add -D @types/bcryptjs

# Validation
pnpm add zod

# Utilities
pnpm add clsx tailwind-merge slugify
pnpm add lucide-react

# Payment & Shipping
pnpm add xendit-node

# UI Helpers
pnpm add sonner
pnpm add nuqs
pnpm add @tanstack/react-table

# Dev
pnpm add -D tsx
```

### Cek `package.json`
Pastikan dependencies muncul:
```json
{
  "dependencies": {
    "drizzle-orm": "^0.38.x",
    "mysql2": "^3.x",
    "next-auth": "^5.0.0-beta.x",
    "bcryptjs": "^2.x",
    "zod": "^3.x",
    ...
  }
}
```

---

## 5. Setup Environment Variables

### Buat `.env.local`
```bash
# Database
DATABASE_URL=mysql://root:password@localhost:3306/next_olshop_db

# Auth
AUTH_SECRET=your-random-secret-key-here-min-32-chars

# Payment (Xendit Test)
XENDIT_SECRET_KEY=xnd_development_xxx
XENDIT_WEBHOOK_TOKEN=any-string-you-want

# Shipping (Bitship Test)
BITSHIP_API_URL=https://api.biteship.com
BITSHIP_API_KEY=biteship_test_xxx

# Cron
CRON_SECRET=any-random-token

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Generate AUTH_SECRET
```bash
# Cara cepat
openssl rand -base64 32
```

Copy hasilnya ke `AUTH_SECRET`.

### Buat `.env.example` (untuk dokumentasi)
```bash
cp .env.local .env.example
# Edit .env.example, ganti semua value jadi placeholder
```

### Tambahkan ke `.gitignore`
```gitignore
.env*.local
.env
```

---

## 6. Setup Path Alias TypeScript

Buka `tsconfig.json`, pastikan ada:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Sekarang bisa import dengan `@/lib/...`, `@/components/...`.

---

## 7. Bikin Struktur Folder Awal

```bash
mkdir -p app/{actions,api}
mkdir -p app/\(shop\) app/\(auth\) app/\(admin\)
mkdir -p components/{shop,admin,ui}
mkdir -p lib/db
mkdir -p types
```

> 💡 **Tips**: Folder dengan tanda kurung `(shop)` adalah **Route Group** — folder ini tidak mempengaruhi URL, hanya untuk organisasi.

Struktur akhir:
```
app/
  (admin)/
  (auth)/
  (shop)/
  actions/
  api/
  layout.tsx
  page.tsx
  globals.css
components/
  admin/
  shop/
  ui/
lib/
  db/
types/
```

---

## 8. Setup Helper `cn()` & Utility Dasar

Buat `lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
```

---

## 9. Test Run

```bash
pnpm dev
```

Buka `http://localhost:3000` — harus tetap muncul "Next Olshop 🛍️" dan tidak ada error di terminal.

---

## 10. Git Init & First Commit

```bash
git init
git add .
git commit -m "feat: initial setup Next.js 16 + dependencies"
```

> 💡 **Tips Mengajar**: kalau peserta belum punya Git, ajarkan dulu basic Git (init, add, commit, status, log).

---

## ✅ Checklist Akhir Sesi 01

- [ ] Next.js 16 running di `localhost:3000`
- [ ] Tailwind CSS bekerja (background warna, font, dll)
- [ ] Path alias `@/` jalan
- [ ] Dependencies terpasang (drizzle, next-auth, zod, xendit, dll)
- [ ] `.env.local` sudah ada (dengan placeholder dulu)
- [ ] Struktur folder rapi
- [ ] First commit Git

---

## 🐛 Common Issues

| Error | Penyebab | Fix |
|-------|----------|-----|
| `Cannot find module 'next'` | `node_modules` belum install | `pnpm install` |
| `Port 3000 already in use` | Ada Next.js lain running | Kill process atau pakai `pnpm dev -p 3001` |
| `Tailwind classes tidak apply` | `@import "tailwindcss"` belum ada di globals.css | Cek isi globals.css |
| `Cannot find module '@/lib/utils'` | tsconfig paths salah | Restart TS server di VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server" |

---

## ➡️ Lanjut ke [Sesi 02 — Database](./02-database.md)
