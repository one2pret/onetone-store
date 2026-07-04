// app/(admin)/dashboard/products/_components/ProductForm.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createProduct, updateProduct } from '@/app/actions/products';
import { upsertProductVariants } from '@/app/actions/product-variants';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { ImageIcon, Plus, Trash2, ExternalLink } from 'lucide-react';
import { VariantManager, type VariantRow } from './VariantManager';
import type { Product, Category, ProductVariant } from '@/lib/db/schema';

interface Props {
  product?: Product | null;
  categories: Category[];
  variants?: ProductVariant[];
  usedInOrderIds?: number[];
  usedInCartIds?: number[];
}

type ActionResult = {
  success: boolean;
  errors?: Record<string, string[]>;
  productId?: number;
} | null;

// ── Image URL Input ──────────────────────────────────────────────────────────
function ImageUrlInput({
  value, onChange, placeholder, label, error, name,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; label: string; error?: string; name: string;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="space-y-2">
      <Label className="text-foreground">{label}</Label>
      <div className="flex gap-3">
        <div className="w-24 h-24 shrink-0 rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center">
          {value && !imgError ? (
            <img src={value} alt="preview" className="w-full h-full object-cover"
              onError={() => setImgError(true)} onLoad={() => setImgError(false)} />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Input name={name} type="url" value={value}
            onChange={(e) => { setImgError(false); onChange(e.target.value); }}
            placeholder={placeholder ?? 'https://...'} className="text-sm" />
          {value && (
            <div className="flex items-center gap-2">
              {imgError && <span className="text-xs text-destructive">⚠ URL tidak valid</span>}
              {!imgError && <span className="text-xs text-green-600 dark:text-green-400">✓ Valid</span>}
              <a href={value} target="_blank" rel="noopener noreferrer"
                className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Buka
              </a>
            </div>
          )}
          {!value && <p className="text-xs text-muted-foreground">Paste URL gambar dari Cloudinary atau hosting lain</p>}
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

// ── Multi-image URL list ─────────────────────────────────────────────────────
function MultiImageInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function add() { onChange([...value, '']); }
  function remove(i: number) { onChange(value.filter((_, idx) => idx !== i)); }
  function upd(i: number, v: string) { const n = [...value]; n[i] = v; onChange(n); }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-foreground">Foto Tambahan (Galeri)</Label>
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-7 text-xs gap-1">
          <Plus className="w-3.5 h-3.5" /> Tambah Foto
        </Button>
      </div>
      {value.length === 0 && <p className="text-xs text-muted-foreground py-1">Opsional — foto galeri tambahan.</p>}
      <div className="space-y-2">
        {value.map((url, i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="w-12 h-12 shrink-0 rounded-lg border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
              {url ? <img src={url} alt={`extra-${i}`} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
            </div>
            <Input type="url" value={url} onChange={(e) => upd(i, e.target.value)} placeholder="https://..." className="text-sm flex-1" />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}
              className="shrink-0 text-muted-foreground hover:text-destructive h-9 w-9">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ProductForm ─────────────────────────────────────────────────────────
export function ProductForm({ product, categories, variants = [], usedInOrderIds = [], usedInCartIds = [] }: Props) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult>(null);
  const [isPending, startTransition] = useTransition();
  const [variantManagerKey, setVariantManagerKey] = useState(0);

  const existingImages: string[] = (() => {
    try { return product?.images ? JSON.parse(product.images) : []; } catch { return []; }
  })();

  const [mainImage, setMainImage] = useState(product?.image ?? '');
  const [extraImages, setExtraImages] = useState<string[]>(existingImages);

  // FIX: init with full VariantRow shape including _key and isActive
  const [variantRows, setVariantRows] = useState<VariantRow[]>(
    variants.map((v) => ({
      _key: Math.random().toString(36).slice(2),
      size: v.size,
      color: v.color,
      colorHex: v.colorHex ?? '',
      stock: v.stock,
      priceModifier: parseFloat(String(v.priceModifier ?? 0)),
      sku: v.sku ?? '',
      isActive: v.isActive ?? true,
    }))
  );

  const imagesJson = JSON.stringify(extraImages.filter(Boolean));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('image', mainImage);
    formData.set('images', imagesJson);

    startTransition(async () => {
      let result: ActionResult;

      if (product) {
        // UPDATE — no redirect() in action, so this returns properly
        result = await updateProduct(product.id, null, formData);
        if (result?.success) {
          await upsertProductVariants(product.id, variantRows);
        }
      } else {
        // CREATE — action returns { success, productId }
        result = await createProduct(null, formData);
        if (result?.success && result.productId) {
          await upsertProductVariants(result.productId, variantRows);
        }
      }

      setState(result);

      if (result?.success) {
        if (product) {
          toast.success('Produk berhasil diperbarui');
          setVariantManagerKey((k) => k + 1);
          router.refresh();
        } else {
          toast.success('Produk berhasil dibuat');
          router.push(`/dashboard/products/${result.productId}/edit`);
        }
      } else if (result && !result.success) {
        toast.error('Gagal menyimpan produk');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="image" value={mainImage} />
      <input type="hidden" name="images" value={imagesJson} />

      {state?.errors?._form && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm">
          {state.errors._form[0]}
        </div>
      )}

      {/* ── Informasi Produk ───────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Informasi Produk</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-foreground">
              Nama Produk <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" type="text" defaultValue={product?.name}
              required className="mt-1" placeholder="Contoh: Legging Sports ONETONE" />
            {state?.errors?.name && <p className="text-destructive text-sm mt-1">{state.errors.name[0]}</p>}
          </div>

          <div>
            <Label htmlFor="categoryId" className="text-foreground">Kategori</Label>
            <select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ''}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
              <option value="">Pilih kategori...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="description" className="text-foreground">Deskripsi</Label>
            <Textarea id="description" name="description" rows={4}
              defaultValue={product?.description || ''} className="mt-1"
              placeholder="Deskripsi produk..." />
          </div>
        </div>
      </div>

      {/* ── Foto Produk ────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-semibold text-foreground mb-1">Foto Produk</h2>
        <p className="text-xs text-muted-foreground mb-5">
          Gunakan URL dari Cloudinary, Google Drive (share link), atau hosting lain.
        </p>
        <div className="space-y-6">
          <ImageUrlInput name="_mainImageDisplay" label="Foto Utama *" value={mainImage}
            onChange={setMainImage}
            placeholder="https://res.cloudinary.com/..."
            error={state?.errors?.image?.[0]} />
          <div className="border-t border-border pt-5">
            <MultiImageInput value={extraImages} onChange={setExtraImages} />
          </div>
        </div>
      </div>

      {/* ── Harga & Stok ───────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-semibold text-foreground mb-1">Harga & Stok Dasar</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Harga & stok ini adalah nilai default. Stok per varian diatur di bagian Varian Produk di bawah.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="price" className="text-foreground">
              Harga (Rp) <span className="text-destructive">*</span>
            </Label>
            <CurrencyInput id="price" name="price"
              defaultValue={product?.price ? Number(product.price) : ''}
              required className="mt-1" />
            {state?.errors?.price && <p className="text-destructive text-sm mt-1">{state.errors.price[0]}</p>}
          </div>
          <div>
            <Label htmlFor="stock" className="text-foreground">
              Stok Total <span className="text-destructive">*</span>
            </Label>
            <Input id="stock" name="stock" type="number" min="0"
              defaultValue={product?.stock ?? 0} required className="mt-1" />
            {state?.errors?.stock && <p className="text-destructive text-sm mt-1">{state.errors.stock[0]}</p>}
          </div>
          <div>
            <Label htmlFor="weight" className="text-foreground">Berat (gram)</Label>
            <Input id="weight" name="weight" type="number" min="0"
              defaultValue={product?.weight ?? 0} className="mt-1" />
          </div>
        </div>
      </div>

      {/* ── Varian Produk ─────────────────────────────────── */}
      <VariantManager key={variantManagerKey} initial={variants} onChange={setVariantRows} usedInOrderIds={usedInOrderIds} usedInCartIds={usedInCartIds} />

      {/* ── Pengaturan ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Pengaturan</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="isActive" defaultChecked={product?.isActive ?? true}
              className="w-4 h-4 accent-primary rounded" />
            <span className="text-sm text-foreground">Produk aktif (tampil di toko)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured ?? false}
              className="w-4 h-4 accent-primary rounded" />
            <span className="text-sm text-foreground">Produk unggulan (tampil di halaman utama)</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : product ? 'Update Produk' : 'Tambah Produk'}
        </Button>
        <Button variant="ghost" asChild>
          <a href="/dashboard/products">Batal</a>
        </Button>
      </div>
    </form>
  );
}
