# Next Olshop — Project Rules

## Project Overview
Aplikasi **Online Shop (Olshop)** single-store untuk UMKM/bisnis personal.
Bukan marketplace — satu toko, dua persona: **Admin** (pemilik toko) dan **Customer** (pembeli).

## Tech Stack
- **Framework**: Next.js 16 (App Router, Server Components, Server Actions, Turbopack)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4 (utility-first, responsive-first)
- **Database**: MySQL via `mysql2`
- **ORM**: Drizzle ORM 0.38+ (`drizzle-kit` untuk migrations)
- **Auth**: NextAuth v5 (beta) — Credentials provider, JWT strategy
- **Validation**: Zod
- **Icons**: Lucide React
- **Utils**: clsx + tailwind-merge (`cn()` helper di `lib/utils.ts`)

## Project Structure
```
app/
  (shop)/          → Customer-facing pages (landing, products, cart, checkout, orders)
  (auth)/          → Login & Register pages
  (admin)/         → Admin dashboard & management pages
  api/             → REST API routes (untuk Flutter consumption)
  actions/         → Server Actions (products, orders, cart, auth)
components/
  shop/            → Customer UI components (Navbar, ProductCard, Footer, etc.)
  admin/           → Admin UI components (Sidebar, Header, etc.)
lib/
  db/              → Database connection, schema, seed
  auth.ts          → NextAuth config
  auth.config.ts   → Edge-compatible auth config
  utils.ts         → Utility functions
types/             → TypeScript type definitions
```

## Naming Conventions
- **Project name**: "Next Olshop" (bukan ecommerce)
- **Files**: kebab-case untuk routes, PascalCase untuk components
- **Database tables**: snake_case (users, cart_items, order_items)
- **Variables/functions**: camelCase
- **Types/Interfaces**: PascalCase
- **Server Actions**: camelCase verb prefix (createProduct, updateOrder, deleteCartItem)
- **API routes**: RESTful — `/api/products`, `/api/orders/[id]`

## Coding Rules

### Next.js Patterns
- Gunakan **Server Components** by default, `'use client'` hanya jika butuh interactivity
- Gunakan **Server Actions** (`'use server'`) untuk semua mutasi data, bukan API routes
- API routes HANYA untuk konsumsi external (Flutter app)
- Gunakan `revalidatePath()` setelah mutasi untuk cache busting
- Layout hierarchy: Root → Route Group Layout → Page
- Loading states via `loading.tsx`, error handling via `error.tsx`

### Database & ORM
- Schema definition di `lib/db/schema.ts`
- Gunakan Drizzle `relations()` untuk define relasi antar tabel
- Semua query pakai Drizzle query builder, JANGAN raw SQL
- Decimal fields untuk harga: `decimal('price', { precision: 12, scale: 2 })`
- Timestamps: `createdAt` dan `updatedAt` dengan default `now()`
- Enum fields untuk status: gunakan `mysqlEnum()`

### Styling (Tailwind CSS 4)
- Mobile-first responsive design: `sm:`, `md:`, `lg:`, `xl:`
- Gunakan `cn()` helper untuk conditional classes
- Design modern, clean, minimalist
- Color palette konsisten — gunakan CSS variables atau Tailwind config
- Spacing konsisten: 4px grid system (p-1, p-2, p-4, p-6, p-8)
- Rounded corners: `rounded-lg` atau `rounded-xl` untuk cards
- Shadows: `shadow-sm` untuk subtle depth

### Authentication & Authorization
- Middleware di `middleware.ts` untuk route protection
- Admin routes: `/dashboard/*` — require role `admin`
- Customer protected routes: `/cart`, `/checkout`, `/orders` — require authenticated
- Auth routes: `/login`, `/register` — redirect jika sudah login
- Session check via `auth()` di Server Components

### Form & Validation
- Validasi dengan Zod schema sebelum database operation
- Server-side validation WAJIB, client-side validation optional (UX)
- Error messages dalam Bahasa Indonesia untuk user-facing
- Handle loading states di form submissions

### API Response Format
```typescript
// Success
{ success: true, data: T }
// Error
{ success: false, error: string }
// List with pagination
{ success: true, data: T[], meta: { page, limit, total } }
```

## Database Schema Overview
| Table | Purpose |
|-------|---------|
| users | Admin & customer accounts |
| categories | Product categories |
| products | Product catalog |
| cart_items | Shopping cart per user |
| orders | Customer orders |
| order_items | Items in each order |

## Key Commands
```bash
pnpm dev              # Dev server (Turbopack)
pnpm build            # Production build
pnpm db:push          # Push schema to MySQL
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed sample data
```

## Design Principles
- **Responsive**: Harus bagus di mobile, tablet, desktop
- **Modern**: Clean UI, whitespace yang cukup, typography jelas
- **Fast**: Leverage Server Components, minimal client JS
- **Accessible**: Semantic HTML, proper labels, keyboard navigation
- **Indonesian Context**: Harga dalam Rupiah (Rp), alamat Indonesia, kurir lokal
