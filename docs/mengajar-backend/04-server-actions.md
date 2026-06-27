# Sesi 04 — Server Actions (CRUD Produk)

> ⏱️ Estimasi: 45 menit
> 🎯 Tujuan: Peserta paham konsep Server Actions, bisa bikin CRUD produk lengkap (Create, Read, Update, Delete) dari admin dashboard.

---

## 1. Konsep (10 menit)

### Apa itu Server Actions?
- **Function async yang dijalankan di server, dipanggil dari client/server component**
- Dideklarasikan dengan `'use server'`
- Pengganti API route untuk **mutasi data web app**
- Auto handle CSRF, type-safe, integrasi dengan `<form action>`

### Server Actions vs API Routes
| Server Actions | API Routes |
|----------------|------------|
| Untuk **web app mutations** | Untuk **external clients** (Flutter, mobile, 3rd party) |
| Type-safe end-to-end | Manual JSON typing |
| Auto serialize | Manual serialize |
| `revalidatePath()` built-in | Manual invalidation |

**Aturan di project ini**:
- Web app → **Server Actions**
- Flutter app → **API Routes**

---

## 2. Buat Server Action Pertama — `getProducts`

Buat `app/actions/products.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { products, categories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function getProducts() {
  const rows = await db
    .select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(desc(products.createdAt));

  return rows.map((row) => ({
    ...row.products,
    category: row.categories,
  }));
}

export async function getActiveProducts() {
  const rows = await db
    .select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.isActive, true))
    .orderBy(desc(products.createdAt));

  return rows.map((row) => ({
    ...row.products,
    category: row.categories,
  }));
}

export async function getProduct(id: number) {
  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return result[0] || null;
}
```

### Pakai di Server Component
```tsx
// app/(admin)/dashboard/products/page.tsx
import { getProducts } from "@/app/actions/products";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div>
      <h1>Produk ({products.length})</h1>
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {p.name} — Rp{p.price}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 3. `createProduct` — Form Action

Tambah di `app/actions/products.ts`:

```typescript
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import slugify from "slugify";

const productSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  stock: z.coerce.number().int().min(0),
  weight: z.coerce.number().int().min(0),
  categoryId: z.coerce.number().optional().nullable(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
});

export async function createProduct(
  prevState: unknown,
  formData: FormData
) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, errors: { _form: ["Forbidden"] } };
  }

  // 2. Validate
  const validated = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    weight: formData.get("weight"),
    categoryId: formData.get("categoryId") || null,
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
  });

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    };
  }

  // 3. Generate slug
  const slug = slugify(validated.data.name, { lower: true, strict: true });

  // 4. Insert
  try {
    await db.insert(products).values({
      name: validated.data.name,
      slug,
      description: validated.data.description,
      price: String(validated.data.price),
      stock: validated.data.stock,
      weight: validated.data.weight,
      categoryId: validated.data.categoryId,
      isActive: validated.data.isActive ?? true,
      isFeatured: validated.data.isFeatured ?? false,
    });
  } catch (err) {
    return { success: false, errors: { _form: ["Gagal menyimpan produk"] } };
  }

  // 5. Revalidate & redirect
  revalidatePath("/dashboard/products");
  revalidatePath("/products");
  redirect("/dashboard/products");
}
```

### Form di Page
Buat `app/(admin)/dashboard/products/new/page.tsx`:

```tsx
import { getCategories } from "@/app/actions/products";
import { ProductForm } from "../_components/ProductForm";

export default async function NewProductPage() {
  const categories = await getCategories();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tambah Produk</h1>
      <ProductForm categories={categories} />
    </div>
  );
}
```

Buat `app/(admin)/dashboard/products/_components/ProductForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createProduct } from "@/app/actions/products";
import type { Category } from "@/lib/db/schema";

export function ProductForm({ categories }: { categories: Category[] }) {
  const [state, formAction, isPending] = useActionState(createProduct, null);

  return (
    <form action={formAction} className="space-y-4 max-w-2xl">
      <div>
        <label>Nama Produk</label>
        <input name="name" required className="w-full border p-2 rounded" />
        {state?.errors?.name && (
          <p className="text-red-500 text-xs">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label>Kategori</label>
        <select name="categoryId" className="w-full border p-2 rounded">
          <option value="">— Pilih —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label>Harga</label>
        <input name="price" type="number" required className="w-full border p-2 rounded" />
      </div>

      <div>
        <label>Stok</label>
        <input name="stock" type="number" defaultValue="0" className="w-full border p-2 rounded" />
      </div>

      <div>
        <label>Berat (gram)</label>
        <input name="weight" type="number" defaultValue="0" className="w-full border p-2 rounded" />
      </div>

      <div>
        <label>Deskripsi</label>
        <textarea name="description" rows={4} className="w-full border p-2 rounded" />
      </div>

      <label className="flex gap-2 items-center">
        <input type="checkbox" name="isActive" defaultChecked />
        <span>Aktif</span>
      </label>

      <label className="flex gap-2 items-center">
        <input type="checkbox" name="isFeatured" />
        <span>Featured</span>
      </label>

      {state?.errors?._form && (
        <div className="bg-red-50 text-red-600 p-3 rounded">
          {state.errors._form[0]}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-[#51B1A6] text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {isPending ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
```

Test: buka `/dashboard/products/new`, isi form, submit → produk baru muncul di list.

---

## 4. `updateProduct` & Edit Page

Tambah di `app/actions/products.ts`:

```typescript
export async function updateProduct(
  id: number,
  prevState: unknown,
  formData: FormData
) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, errors: { _form: ["Forbidden"] } };
  }

  const validated = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    weight: formData.get("weight"),
    categoryId: formData.get("categoryId") || null,
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  await db
    .update(products)
    .set({
      name: validated.data.name,
      description: validated.data.description,
      price: String(validated.data.price),
      stock: validated.data.stock,
      weight: validated.data.weight,
      categoryId: validated.data.categoryId,
      isActive: validated.data.isActive ?? true,
      isFeatured: validated.data.isFeatured ?? false,
    })
    .where(eq(products.id, id));

  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${id}/edit`);
  revalidatePath("/products");
  redirect("/dashboard/products");
}
```

### Edit Page
`app/(admin)/dashboard/products/[id]/edit/page.tsx`:
```tsx
import { getProduct, getCategories } from "@/app/actions/products";
import { ProductForm } from "../../_components/ProductForm";
import { notFound } from "next/navigation";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(Number(id));
  if (!product) notFound();

  const categories = await getCategories();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Produk</h1>
      <ProductForm categories={categories} product={product} />
    </div>
  );
}
```

Update `ProductForm` agar terima prop `product` (opsional) untuk pre-fill defaultValue.

---

## 5. `deleteProduct`

Tambah di `app/actions/products.ts`:

```typescript
export async function deleteProduct(id: number) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, error: "Forbidden" };
  }

  try {
    await db.delete(products).where(eq(products.id, id));
  } catch {
    return { success: false, error: "Gagal menghapus produk (mungkin ada order terkait)" };
  }

  revalidatePath("/dashboard/products");
  return { success: true };
}
```

### Pakai di Client Component
```tsx
"use client";
import { deleteProduct } from "@/app/actions/products";
import { toast } from "sonner";

export function DeleteButton({ id }: { id: number }) {
  async function handleDelete() {
    if (!confirm("Hapus produk ini?")) return;
    const res = await deleteProduct(id);
    if (res.success) {
      toast.success("Produk dihapus");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <button onClick={handleDelete} className="text-red-600">
      Hapus
    </button>
  );
}
```

---

## 6. Bonus — Kategori CRUD

Buat `app/actions/categories.ts` dengan pola sama:
- `getCategories()`
- `createCategory()`
- `updateCategory()`
- `deleteCategory()`

Praktekkan peserta untuk **bikin sendiri** — pola sama persis dengan produk.

---

## 7. Pattern Penting

### Pattern 1: Auth Check di Awal
```typescript
const session = await auth();
if (!session?.user) return { success: false, error: "Unauthorized" };
if (session.user.role !== "admin") return { success: false, error: "Forbidden" };
```

### Pattern 2: Zod Validation
```typescript
const validated = schema.safeParse({...});
if (!validated.success) {
  return { success: false, errors: validated.error.flatten().fieldErrors };
}
```

### Pattern 3: Revalidate Setelah Mutasi
```typescript
revalidatePath("/dashboard/products"); // admin list
revalidatePath("/products");            // public catalog
```

### Pattern 4: Redirect di Luar Try-Catch
```typescript
// ❌ SALAH — redirect throws special error
try {
  await db.insert(...);
  redirect("/list");
} catch (err) {
  // redirect ke catch! Bug.
}

// ✅ BENAR
try {
  await db.insert(...);
} catch (err) {
  return { success: false, error: "..." };
}
redirect("/list"); // di luar try-catch
```

### Pattern 5: FormData Gotchas
```typescript
// Checkbox: 'on' kalau dicentang, null kalau tidak
formData.get("isActive") === "on"

// Number: pakai z.coerce.number()
z.coerce.number()

// Nullable: || null
formData.get("categoryId") || null
```

---

## ✅ Checklist Akhir Sesi 04

- [ ] `getProducts()`, `getActiveProducts()`, `getProduct()` jalan
- [ ] Bisa create produk via form
- [ ] Bisa edit produk via form
- [ ] Bisa delete produk dengan konfirmasi
- [ ] Validation error tampil di form
- [ ] Auth check (non-admin tidak bisa CRUD)
- [ ] List auto-update setelah mutasi (revalidatePath)

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `redirect not allowed in Server Action` | Letakkan `redirect()` di luar try-catch |
| Form tidak submit | Pastikan ada `name` di setiap input |
| `isActive` selalu false | Checkbox kirim `'on'`, bukan `true` |
| Number jadi string | Pakai `z.coerce.number()` |
| List tidak update setelah create | Lupa `revalidatePath()` |
| `Cannot read properties of undefined (reading 'flatten')` | Pakai `safeParse` bukan `parse` |

---

## ➡️ Lanjut ke [Sesi 05 — REST API untuk Flutter](./05-api-routes.md)
