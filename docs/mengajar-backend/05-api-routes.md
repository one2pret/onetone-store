# Sesi 05 — REST API untuk Flutter

> ⏱️ Estimasi: 45 menit
> 🎯 Tujuan: Peserta bisa bikin REST API endpoint yang dikonsumsi Flutter app — register, login (return token), get products, cart, orders.

---

## 1. Konsep (10 menit)

### Server Actions vs API Routes (Recap)
- **Server Actions**: dipanggil dari **same Next.js app** (web browser)
- **API Routes**: dipanggil dari **external client** (Flutter, mobile, 3rd party)

### Auth Strategy untuk Flutter
NextAuth session cookie tidak praktis untuk Flutter. Solusi:

1. **Login API** → return JWT Bearer token
2. **Flutter** simpan token di secure storage
3. **Flutter** kirim `Authorization: Bearer {token}` di header
4. **Backend** verify token di setiap protected endpoint

### Response Format Standar
```typescript
// Success
{ "success": true, "data": {...} }

// Success with pagination
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 10, "total": 50 } }

// Error
{ "success": false, "error": "Message in Bahasa Indonesia" }
```

---

## 2. Setup API Auth Helper

Sudah dibuat di Sesi 03, recap di `lib/api-auth.ts`:

```typescript
import { jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export async function signApiToken(payload: {
  id: string;
  email: string;
  role: string;
}) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyApiToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

export async function getApiUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  return await verifyApiToken(token);
}
```

---

## 3. API: Register

Buat `app/api/auth/register/route.ts`:

```typescript
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signApiToken } from "@/lib/api-auth";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = schema.safeParse(body);

    if (!validated.success) {
      return Response.json(
        { success: false, error: "Data tidak valid", errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Cek email
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, validated.data.email))
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        { success: false, error: "Email sudah terdaftar" },
        { status: 409 }
      );
    }

    // Hash + insert
    const hashedPassword = await bcrypt.hash(validated.data.password, 10);
    const [result] = await db.insert(users).values({
      name: validated.data.name,
      email: validated.data.email,
      password: hashedPassword,
      phone: validated.data.phone || null,
      role: "customer",
    }).$returningId();

    // Generate token
    const token = await signApiToken({
      id: String(result.id),
      email: validated.data.email,
      role: "customer",
    });

    return Response.json({
      success: true,
      data: {
        user: {
          id: result.id,
          name: validated.data.name,
          email: validated.data.email,
          role: "customer",
        },
        token,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return Response.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
```

### Test dengan curl/Postman
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

Output:
```json
{
  "success": true,
  "data": {
    "user": {"id": 3, "name": "Test User", ...},
    "token": "eyJhbGc..."
  }
}
```

---

## 4. API: Login

Buat `app/api/auth/login/route.ts`:

```typescript
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signApiToken } from "@/lib/api-auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const validated = schema.safeParse(body);

  if (!validated.success) {
    return Response.json(
      { success: false, error: "Data tidak valid" },
      { status: 400 }
    );
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, validated.data.email))
    .limit(1);

  const user = result[0];
  if (!user) {
    return Response.json(
      { success: false, error: "Email atau password salah" },
      { status: 401 }
    );
  }

  const isValid = await bcrypt.compare(validated.data.password, user.password);
  if (!isValid) {
    return Response.json(
      { success: false, error: "Email atau password salah" },
      { status: 401 }
    );
  }

  const token = await signApiToken({
    id: String(user.id),
    email: user.email,
    role: user.role ?? "customer",
  });

  return Response.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      token,
    },
  });
}
```

Test:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

Save token untuk request berikutnya.

---

## 5. API: Get Products (Public)

Buat `app/api/products/route.ts`:

```typescript
import { db } from "@/lib/db";
import { products, categories } from "@/lib/db/schema";
import { eq, and, like, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const categorySlug = searchParams.get("category");
  const limit = Number(searchParams.get("limit") ?? "20");

  const conditions = [eq(products.isActive, true)];
  if (search) {
    conditions.push(like(products.name, `%${search}%`));
  }

  let query = db
    .select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(limit);

  if (categorySlug) {
    query = db
      .select()
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions, eq(categories.slug, categorySlug)))
      .orderBy(desc(products.createdAt))
      .limit(limit);
  }

  const rows = await query;
  const data = rows.map((row) => ({
    ...row.products,
    category: row.categories,
  }));

  return Response.json({ success: true, data });
}
```

### API: Get Product Detail
Buat `app/api/products/[id]/route.ts`:

```typescript
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await db.query.products.findFirst({
    where: eq(products.id, Number(id)),
    with: { category: true },
  });

  if (!result) {
    return Response.json(
      { success: false, error: "Produk tidak ditemukan" },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: result });
}
```

### Test
```bash
# List
curl http://localhost:3000/api/products

# Filter
curl "http://localhost:3000/api/products?category=elektronik&search=earbuds"

# Detail
curl http://localhost:3000/api/products/1
```

---

## 6. API: Cart (Protected)

Buat `app/api/cart/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cartItems, products } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getApiUser } from "@/lib/api-auth";
import { z } from "zod";

// GET: list cart items
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.userId, Number(user.id)),
    with: { product: true },
  });

  return Response.json({ success: true, data: items });
}

// POST: add to cart
const addSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validated = addSchema.safeParse(body);
  if (!validated.success) {
    return Response.json({ success: false, error: "Data tidak valid" }, { status: 400 });
  }

  const { productId, quantity } = validated.data;

  // Cek produk exist & stock cukup
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });
  if (!product) {
    return Response.json({ success: false, error: "Produk tidak ditemukan" }, { status: 404 });
  }
  if ((product.stock ?? 0) < quantity) {
    return Response.json({ success: false, error: "Stok tidak cukup" }, { status: 400 });
  }

  // Cek apakah sudah ada di cart
  const existing = await db.query.cartItems.findFirst({
    where: and(
      eq(cartItems.userId, Number(user.id)),
      eq(cartItems.productId, productId)
    ),
  });

  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: existing.quantity + quantity })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      userId: Number(user.id),
      productId,
      quantity,
    });
  }

  return Response.json({ success: true });
}
```

### Cart Item Detail (Update/Delete)
Buat `app/api/cart/[id]/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cartItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getApiUser } from "@/lib/api-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser(request);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { quantity } = await request.json();

  // Ownership check
  const item = await db.query.cartItems.findFirst({
    where: and(
      eq(cartItems.id, Number(id)),
      eq(cartItems.userId, Number(user.id))
    ),
  });
  if (!item) {
    return Response.json({ success: false, error: "Item tidak ditemukan" }, { status: 404 });
  }

  await db
    .update(cartItems)
    .set({ quantity })
    .where(eq(cartItems.id, Number(id)));

  return Response.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser(request);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db
    .delete(cartItems)
    .where(
      and(
        eq(cartItems.id, Number(id)),
        eq(cartItems.userId, Number(user.id))
      )
    );

  return Response.json({ success: true });
}
```

---

## 7. API: Orders

Buat `app/api/orders/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getApiUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userOrders = await db.query.orders.findMany({
    where: eq(orders.userId, Number(user.id)),
    orderBy: desc(orders.createdAt),
    with: {
      items: true,
      invoices: true,
    },
  });

  return Response.json({ success: true, data: userOrders });
}
```

Order detail di `app/api/orders/[id]/route.ts` (dengan ownership check + tracking).

Order POST (create) akan dibahas di Sesi 06 (Cart & Checkout Flow).

---

## 8. API: Categories

Buat `app/api/categories/route.ts`:

```typescript
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";

export async function GET() {
  const data = await db.select().from(categories);
  return Response.json({ success: true, data });
}
```

---

## 9. Test Pakai Postman/Bruno

### Buat Collection
1. **POST** `/api/auth/register` — daftar
2. **POST** `/api/auth/login` — simpan token ke variable `{{token}}`
3. **GET** `/api/products` — public
4. **GET** `/api/cart` — Header: `Authorization: Bearer {{token}}`
5. **POST** `/api/cart` — Add product
6. **GET** `/api/orders` — list pesanan user

### Tips Test
- Save response token sebagai env variable
- Buat folder per resource (Auth, Products, Cart, Orders)
- Tambah test script untuk verify `success: true`

---

## 10. CORS untuk Flutter

Kalau Flutter dev di emulator, biasanya tidak masalah. Tapi untuk safety:

Buat `app/api/cors.ts` (helper):
```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
```

Atau set di `middleware.ts`:
```typescript
// Sebelum return next
if (request.nextUrl.pathname.startsWith("/api")) {
  response.headers.set("Access-Control-Allow-Origin", "*");
}
```

---

## ✅ Checklist Akhir Sesi 05

- [ ] `POST /api/auth/register` jalan, return token
- [ ] `POST /api/auth/login` jalan, return token
- [ ] `GET /api/products` jalan (public)
- [ ] `GET /api/products/[id]` jalan
- [ ] `GET /api/cart` jalan (perlu Bearer token)
- [ ] `POST /api/cart` bisa add item
- [ ] `PUT /api/cart/[id]` bisa update qty
- [ ] `DELETE /api/cart/[id]` bisa hapus
- [ ] `GET /api/orders` return order user
- [ ] Postman/Bruno collection siap

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `401 Unauthorized` di endpoint protected | Cek Header `Authorization: Bearer {token}` |
| `Cannot parse JSON` | Body request bukan JSON, atau Header `Content-Type: application/json` missing |
| `User can see other user's cart` | Lupa filter `userId` di query — security bug! |
| Token expired | Re-login untuk dapat token baru |
| `getApiUser returns null` | Token salah/tidak ada. Cek di jwt.io |

---

## 📝 Daftar Endpoint Lengkap

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Daftar user baru, return token |
| POST | `/api/auth/login` | Public | Login, return token |
| GET | `/api/products` | Public | List produk (filter, search) |
| GET | `/api/products/[id]` | Public | Detail produk |
| GET | `/api/categories` | Public | List kategori |
| GET | `/api/cart` | User | Cart user |
| POST | `/api/cart` | User | Add to cart |
| PUT | `/api/cart/[id]` | User | Update qty |
| DELETE | `/api/cart/[id]` | User | Hapus item |
| GET | `/api/orders` | User | List order user |
| GET | `/api/orders/[id]` | User | Detail order |
| POST | `/api/orders` | User | Create order (Sesi 06) |
| GET | `/api/addresses` | User | List alamat |
| POST | `/api/addresses` | User | Tambah alamat |

---

## ➡️ Lanjut ke [Sesi 06 — Cart & Orders Flow](./06-cart-orders.md)
