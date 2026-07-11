// app/(admin)/dashboard/settings/_components/EditorialSettingsCard.tsx
"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  upsertEditorialConfig,
  uploadEditorialImage,
  removeEditorialImage,
  type EditorialBreakConfig,
  type EditorialMode,
} from "@/app/actions/editorial-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Upload,
  Trash2,
  Sparkles,
  ShoppingBag,
  Link as LinkIcon,
  ImagePlus,
  Layout as LayoutIcon,
} from "lucide-react";
import type { ProductWithCategory } from "@/lib/db/schema";

interface Props {
  breaks: [EditorialBreakConfig, EditorialBreakConfig];
  products: ProductWithCategory[];
}

const MODES: Array<{
  id: EditorialMode;
  label: string;
  desc: string;
  icon: typeof Sparkles;
}> = [
  { id: "auto", label: "Otomatis", desc: "Pakai produk unggulan / best seller.", icon: Sparkles },
  { id: "product", label: "Pilih Produk", desc: "Kunci ke satu produk.", icon: ShoppingBag },
  { id: "upload", label: "Upload Foto", desc: "Upload foto campaign ke R2.", icon: ImagePlus },
  { id: "url", label: "URL Kustom", desc: "Paste URL eksternal.", icon: LinkIcon },
];

export function EditorialSettingsCard({ breaks, products }: Props) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-8">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <LayoutIcon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">Editorial Break</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dua section besar di landing (antara grid produk). Atur foto dan copy per section.
          </p>
        </div>
      </div>

      {breaks.map((cfg, i) => (
        <EditorialBreakEditor
          key={cfg.index}
          config={cfg}
          products={products}
          divider={i < breaks.length - 1}
        />
      ))}
    </div>
  );
}

function EditorialBreakEditor({
  config,
  products,
  divider,
}: {
  config: EditorialBreakConfig;
  products: ProductWithCategory[];
  divider: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savePending, startSave] = useTransition();
  const [uploading, setUploading] = useState(false);

  const [mode, setMode] = useState<EditorialMode>(config.mode);
  const [productId, setProductId] = useState<string>(
    config.productId ? String(config.productId) : String(products[0]?.id ?? "")
  );
  const [imageUrl, setImageUrl] = useState(config.imageUrl);
  const [objectKey, setObjectKey] = useState(config.objectKey);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(
    config.mode === "upload" && config.resolvedImageUrl ? config.resolvedImageUrl : null
  );

  const [eyebrow, setEyebrow] = useState(config.copyOverride.eyebrow || "");
  const [title, setTitle] = useState(config.copyOverride.title || "");
  const [body, setBody] = useState(config.copyOverride.body || "");
  const [ctaLabel, setCtaLabel] = useState(config.copyOverride.ctaLabel || "");
  const [ctaHref, setCtaHref] = useState(config.copyOverride.ctaHref || "");

  // Preview image dari mode aktif
  const previewImage =
    mode === "url"
      ? imageUrl || null
      : mode === "upload"
        ? uploadedUrl
        : mode === "product"
          ? products.find((p) => String(p.id) === productId)?.image ?? null
          : config.index === 1
            ? products.find((p) => p.isFeatured)?.image ?? null
            : products.find((p) => p.isBestSeller)?.image ?? null;

  function handleSave() {
    startSave(async () => {
      const result = await upsertEditorialConfig(config.index, {
        mode,
        productId: mode === "product" ? productId : "",
        imageUrl: mode === "url" ? imageUrl : "",
        eyebrow,
        title,
        body,
        ctaLabel,
        ctaHref,
      });
      if (!result.success) {
        toast.error(result.error || "Gagal menyimpan");
        return;
      }
      toast.success(`Editorial break #${config.index} disimpan`);
      router.refresh();
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const result = await uploadEditorialImage(config.index, fd);
      if (!result.success) {
        toast.error(result.error || "Gagal upload");
        return;
      }
      setObjectKey(result.objectKey!);
      setUploadedUrl(result.url!);
      setMode("upload");
      toast.success("Foto berhasil di-upload");
      router.refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveUpload() {
    startSave(async () => {
      const result = await removeEditorialImage(config.index);
      if (!result.success) {
        toast.error(result.error || "Gagal hapus foto");
        return;
      }
      setObjectKey("");
      setUploadedUrl(null);
      toast.success("Foto dihapus");
      router.refresh();
    });
  }

  const defaultCopy = config.copy; // sudah merged default + override

  return (
    <div className={divider ? "pb-8 border-b border-border" : ""}>
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {config.index}
        </span>
        <h3 className="text-sm font-semibold text-foreground">
          Editorial Break #{config.index}
        </h3>
        {config.reverse && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            layout dibalik
          </span>
        )}
      </div>

      {/* Mode picker */}
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 mb-6">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={[
                "text-left p-3 rounded-lg border-2 transition",
                active
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/40 bg-background",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 mb-1">
                <m.icon
                  className={
                    active ? "w-3.5 h-3.5 text-primary" : "w-3.5 h-3.5 text-muted-foreground"
                  }
                />
                <span
                  className={
                    active
                      ? "text-xs font-semibold text-primary"
                      : "text-xs font-semibold text-foreground"
                  }
                >
                  {m.label}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">{m.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Mode input */}
      {mode === "product" && (
        <div className="space-y-2 mb-6">
          <Label htmlFor={`ed-${config.index}-product`} className="text-foreground">
            Pilih Produk
          </Label>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada produk aktif. Tambahkan lewat halaman Produk.
            </p>
          ) : (
            <select
              id={`ed-${config.index}-product`}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {products.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === "url" && (
        <div className="space-y-2 mb-6">
          <Label htmlFor={`ed-${config.index}-url`} className="text-foreground">
            URL Gambar
          </Label>
          <Input
            id={`ed-${config.index}-url`}
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://cdn.onetone.id/campaign/xxx.webp"
          />
          <p className="text-xs text-muted-foreground">
            Format disarankan: WebP atau JPG, rasio 21:12 (desktop) / 4:5 (mobile).
          </p>
        </div>
      )}

      {mode === "upload" && (
        <div className="space-y-2 mb-6">
          <Label className="text-foreground">Upload Foto Campaign</Label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/webp,image/jpeg,image/png"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <span className="inline-flex items-center">
                {uploading ? (
                  <Loader2 key="upload-loader" className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload key="upload-icon" className="w-4 h-4 mr-2" />
                )}
                <span>
                  {uploading
                    ? "Mengunggah..."
                    : objectKey
                      ? "Ganti Foto"
                      : "Pilih Foto"}
                </span>
              </span>
            </Button>
            {objectKey && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemoveUpload}
                disabled={uploading || savePending}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <span className="inline-flex items-center">
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  <span>Hapus</span>
                </span>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Foto langsung di-upload ke R2. Format: WebP / JPG / PNG, max 5MB.
          </p>
        </div>
      )}

      {/* Preview */}
      <div className="mb-6">
        <Label className="text-foreground mb-2 block">Preview Gambar</Label>
        <div className="relative aspect-[21/12] rounded-lg overflow-hidden border border-border bg-muted max-w-xl">
          {previewImage ? (
            <Image
              src={previewImage}
              alt="Preview editorial"
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-6">
              <LayoutIcon className="w-6 h-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {mode === "url"
                  ? "Masukkan URL untuk preview."
                  : mode === "upload"
                    ? "Upload foto untuk preview."
                    : "Belum ada gambar tersedia."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Copy overrides */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-2">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Teks Editorial
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Kosongkan untuk pakai default.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`ed-${config.index}-eyebrow`} className="text-foreground">
              Eyebrow
            </Label>
            <Input
              id={`ed-${config.index}-eyebrow`}
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              placeholder={defaultCopy.eyebrow}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ed-${config.index}-title`} className="text-foreground">
              Judul
            </Label>
            <Input
              id={`ed-${config.index}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultCopy.title}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`ed-${config.index}-body`} className="text-foreground">
            Isi
          </Label>
          <Textarea
            id={`ed-${config.index}-body`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={defaultCopy.body}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`ed-${config.index}-cta-label`} className="text-foreground">
              CTA Label
            </Label>
            <Input
              id={`ed-${config.index}-cta-label`}
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder={defaultCopy.ctaLabel}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`ed-${config.index}-cta-href`} className="text-foreground">
              CTA Link
            </Label>
            <Input
              id={`ed-${config.index}-cta-href`}
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              placeholder={defaultCopy.ctaHref}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={savePending}>
          <span className="inline-flex items-center">
            {savePending ? (
              <Loader2 key="save-loader" className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save key="save-icon" className="w-4 h-4 mr-2" />
            )}
            <span>
              {savePending ? "Menyimpan..." : `Simpan Break #${config.index}`}
            </span>
          </span>
        </Button>
      </div>
    </div>
  );
}
