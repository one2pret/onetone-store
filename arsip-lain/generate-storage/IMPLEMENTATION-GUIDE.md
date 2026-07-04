# Storage Layer — Panduan Implementasi
## Urutan Eksekusi (copy-paste ke terminal)

### Step 1 — Install deps
```bash
cd ~/Projects/onetone-store
pnpm add @aws-sdk/client-s3 sharp
pnpm add -D @types/sharp
```

### Step 2 — Buat file
```
lib/storage.ts              ← copy dari storage.ts
lib/image-processor.ts      ← copy dari image-processor.ts
app/actions/product-images.ts ← copy dari upload-product-image-action.ts
components/admin/ProductImageUploader.tsx ← copy dari ProductImageUploader.tsx
```

### Step 3 — Update lib/db/schema.ts
Tambahkan kode dari schema-product-images.ts:
- Tambahkan tabel `productImages`
- Tambahkan relasi `productImagesRelations`
- Update `productsRelations` → tambah `images: many(productImages)`

### Step 4 — Update .env.local
Tambahkan variabel dari env-additions.txt

### Step 5 — Setup Cloudflare R2
1. Buka https://dash.cloudflare.com
2. Klik "R2 Object Storage" di sidebar
3. "Create Bucket" → nama: onetone-store
4. Buka bucket → Settings → Public Access → Enable "R2.dev subdomain"
5. Copy public URL → isi NEXT_PUBLIC_CDN_URL
6. Pergi ke "Manage R2 API Tokens" → Create Token
   - Permission: Object Read & Write
   - Specify bucket: onetone-store
7. Copy Access Key ID dan Secret → isi R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
8. Isi R2_ENDPOINT: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   (Account ID ada di R2 Overview page, kanan atas)

### Step 6 — Push schema
```bash
pnpm db:push
```

### Step 7 — Test upload sederhana
```bash
# Buat file test sementara
cat > /tmp/test-upload.mjs << 'TESTEOF'
import { storage, generateObjectKey } from "./lib/storage.ts";
import { readFileSync } from "fs";

const buffer = readFileSync("/path/ke/foto.jpg");
const key = generateObjectKey("test");
const result = await storage.upload(key, buffer, "image/jpeg");
console.log("Upload sukses:", result);
TESTEOF

# Jalankan (pakai tsx)
npx tsx --env-file=.env.local /tmp/test-upload.mjs
```

### Step 8 — Integrasi ke edit produk
Tambahkan `ProductImageUploader` ke halaman edit produk:

```tsx
// Di app/(admin)/dashboard/products/[id]/edit/page.tsx
import { ProductImageUploader } from "@/components/admin/ProductImageUploader";
import { getProductImages } from "@/app/actions/product-images";

export default async function EditProductPage({ params }) {
  const { id } = await params;
  const images = await getProductImages(Number(id));
  
  return (
    <div>
      {/* Form produk yang sudah ada ... */}
      
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Foto Produk</h2>
        <ProductImageUploader 
          productId={Number(id)} 
          initialImages={images} 
        />
      </div>
    </div>
  );
}
```

### Verifikasi Akhir
- [ ] pnpm dev — tidak ada TypeScript error
- [ ] Upload foto dari admin dashboard → muncul di grid
- [ ] Foto muncul di URL CDN (buka di browser)
- [ ] Set primary berhasil (badge "Utama" pindah)
- [ ] Hapus foto → hilang dari R2 dan DB
- [ ] pnpm build — 0 error
