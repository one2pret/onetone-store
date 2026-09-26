"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, QrCode, ReceiptText, Save, Store, Trash2, Upload } from "lucide-react";
import {
  removePosQris,
  removeReceiptLogo,
  updateReceiptSettings,
  uploadPosQris,
  uploadReceiptLogo,
} from "@/app/actions/pos-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Props {
  qrisUrl: string | null;
  receiptFooter: string | null;
  receiptLogoUrl: string | null;
  storeName: string | null;
  storePhone: string | null;
  storeAddress: string | null;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export function PosSettingsCard({
  qrisUrl,
  receiptFooter,
  receiptLogoUrl,
  storeName,
  storePhone,
  storeAddress,
}: Props) {
  const router = useRouter();
  const qrisInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingQris, startQrisUpload] = useTransition();
  const [isUploadingLogo, startLogoUpload] = useTransition();
  const [isSavingReceipt, startSaveReceipt] = useTransition();
  const [currentQrisUrl, setCurrentQrisUrl] = useState(qrisUrl);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(receiptLogoUrl);
  const [name, setName] = useState(storeName?.trim() || "ONETONE");
  const [phone, setPhone] = useState(storePhone ?? "");
  const [address, setAddress] = useState(storeAddress ?? "");
  const [footer, setFooter] = useState(receiptFooter ?? "");

  function validateImage(file: File) {
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE) {
      toast.error("Gunakan gambar JPG, PNG, atau WebP maksimal 10 MB");
      return false;
    }
    return true;
  }

  function handleQrisFile(file: File) {
    if (!validateImage(file)) return;
    const formData = new FormData();
    formData.append("image", file);
    startQrisUpload(async () => {
      const result = await uploadPosQris(formData);
      if (result.success && result.url) {
        setCurrentQrisUrl(result.url);
        toast.success("QRIS berhasil diupload");
        router.refresh();
      } else toast.error(result.error ?? "Gagal mengupload QRIS");
      if (qrisInputRef.current) qrisInputRef.current.value = "";
    });
  }

  function handleLogoFile(file: File) {
    if (!validateImage(file)) return;
    const formData = new FormData();
    formData.append("image", file);
    startLogoUpload(async () => {
      const result = await uploadReceiptLogo(formData);
      if (result.success && result.url) {
        setCurrentLogoUrl(result.url);
        toast.success("Logo struk berhasil diperbarui");
        router.refresh();
      } else toast.error(result.error ?? "Gagal mengupload logo struk");
      if (logoInputRef.current) logoInputRef.current.value = "";
    });
  }

  function handleSaveReceipt() {
    startSaveReceipt(async () => {
      const result = await updateReceiptSettings({
        storeName: name,
        storePhone: phone,
        storeAddress: address,
        receiptFooter: footer,
      });
      if (result.success) {
        toast.success("Pengaturan struk berhasil disimpan");
        router.refresh();
      } else toast.error(result.error ?? "Gagal menyimpan pengaturan struk");
    });
  }

  function handleRemoveLogo() {
    startLogoUpload(async () => {
      const result = await removeReceiptLogo();
      if (result.success) {
        setCurrentLogoUrl(null);
        toast.success("Logo struk dihapus");
        router.refresh();
      } else toast.error(result.error ?? "Gagal menghapus logo struk");
    });
  }

  function handleRemoveQris() {
    startQrisUpload(async () => {
      const result = await removePosQris();
      if (result.success) {
        setCurrentQrisUrl(null);
        toast.success("QRIS dihapus");
        router.refresh();
      } else toast.error(result.error ?? "Gagal menghapus QRIS");
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Struk dan pembayaran POS</h2>
            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted-foreground">
              Atur identitas yang tercetak pada kertas 58 mm. Perubahan ini tidak mengubah alamat origin pengiriman.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-7">
          <section aria-labelledby="receipt-identity-heading">
            <div className="mb-4 flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="receipt-identity-heading" className="text-sm font-semibold text-foreground">Identitas struk</h3>
            </div>

            <div className="mb-5 rounded-lg bg-muted/40 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                  {currentLogoUrl ? (
                    <Image src={currentLogoUrl} alt="Logo struk saat ini" width={112} height={80} unoptimized className="max-h-full w-auto object-contain p-2" />
                  ) : (
                    <ImagePlus className="h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Logo header</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Gunakan logo sederhana dengan kontras tinggi agar tetap terbaca pada printer thermal hitam-putih.
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleLogoFile(file);
                    }}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={isUploadingLogo} onClick={() => logoInputRef.current?.click()}>
                      <Upload className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      {currentLogoUrl ? "Ganti logo" : "Upload logo"}
                    </Button>
                    {currentLogoUrl && (
                      <ConfirmDialog
                        trigger={<Button type="button" variant="ghost" size="sm" disabled={isUploadingLogo} className="text-destructive hover:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Hapus</Button>}
                        title="Hapus logo struk?"
                        description="Struk berikutnya akan dicetak tanpa logo."
                        confirmLabel="Hapus logo"
                        variant="destructive"
                        onConfirm={handleRemoveLogo}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="receiptStoreName">Nama toko</Label>
                <Input id="receiptStoreName" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="ONETONE" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiptStorePhone">Telepon / WhatsApp</Label>
                <Input id="receiptStorePhone" value={phone} maxLength={50} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="receiptStoreAddress">Alamat pada struk</Label>
                <Textarea id="receiptStoreAddress" value={address} maxLength={300} rows={3} onChange={(event) => setAddress(event.target.value)} placeholder="Alamat toko atau lokasi kasir" className="resize-none" />
                <p className="text-right text-[11px] text-muted-foreground">{address.length}/300</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="receiptFooter">Footer struk</Label>
                <Textarea
                  id="receiptFooter"
                  value={footer}
                  maxLength={500}
                  rows={5}
                  onChange={(event) => setFooter(event.target.value)}
                  placeholder={"Terima kasih atas kunjungan Anda.\nRetur maksimal 7 hari dengan membawa struk."}
                  className="resize-none font-mono text-xs"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">Baris baru akan dipertahankan saat dicetak.</p>
                  <p className="shrink-0 text-[11px] text-muted-foreground">{footer.length}/500</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={handleSaveReceipt} disabled={isSavingReceipt || !name.trim()}>
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                {isSavingReceipt ? "Menyimpan..." : "Simpan pengaturan struk"}
              </Button>
            </div>
          </section>

          <section className="border-t border-border pt-6" aria-labelledby="qris-heading">
            <div className="mb-4 flex items-center gap-2">
              <QrCode className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <h3 id="qris-heading" className="text-sm font-semibold text-foreground">QRIS statis</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Ditampilkan kepada pelanggan saat kasir memilih pembayaran QRIS.</p>
              </div>
            </div>
            <input
              ref={qrisInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleQrisFile(file);
              }}
            />
            <div className="flex flex-col gap-4 rounded-lg bg-muted/40 p-4 sm:flex-row sm:items-center">
              <div className="relative flex aspect-square w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                {currentQrisUrl ? (
                  <Image src={currentQrisUrl} alt="QRIS POS" fill unoptimized sizes="112px" className="object-contain p-2" />
                ) : (
                  <QrCode className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-5 text-muted-foreground">JPG, PNG, atau WebP maksimal 10 MB.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={isUploadingQris} onClick={() => qrisInputRef.current?.click()}>
                    <Upload className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    {currentQrisUrl ? "Ganti QRIS" : "Upload QRIS"}
                  </Button>
                  {currentQrisUrl && (
                    <ConfirmDialog
                      trigger={<Button type="button" variant="ghost" size="sm" disabled={isUploadingQris} className="text-destructive hover:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" />Hapus</Button>}
                      title="Hapus gambar QRIS?"
                      description="Pembayaran QRIS tidak akan menampilkan kode sampai gambar baru diupload."
                      confirmLabel="Hapus QRIS"
                      variant="destructive"
                      onConfirm={handleRemoveQris}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start" aria-label="Pratinjau struk">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Pratinjau header 58 mm</p>
          <div className="rounded-xl bg-muted p-4">
            <div className="mx-auto w-full max-w-[58mm] bg-white px-5 py-6 font-mono text-zinc-800 shadow-sm">
              <div className="border-b border-dashed border-zinc-300 pb-3 text-center">
                {currentLogoUrl && (
                  <Image src={currentLogoUrl} alt="Preview logo struk" width={144} height={64} unoptimized className="mx-auto mb-2 max-h-12 w-auto object-contain grayscale" />
                )}
                <p className="text-sm font-bold tracking-wide break-words">{name.trim() || "NAMA TOKO"}</p>
                {address.trim() && <p className="mt-1 whitespace-pre-line text-[9px] leading-3 text-zinc-500">{address}</p>}
                {phone.trim() && <p className="mt-1 text-[9px] text-zinc-500">{phone}</p>}
              </div>
              <div className="space-y-1 py-3 text-[9px]">
                <div className="flex justify-between gap-2"><span>No.</span><span>POS-PREVIEW</span></div>
                <div className="flex justify-between gap-2"><span>Total</span><span className="font-bold">Rp125.000</span></div>
              </div>
              <div className="border-t border-dashed border-zinc-300 pt-3 text-center text-[9px] leading-3 text-zinc-500 whitespace-pre-line">
                {footer.trim() || "Terima kasih atas kunjungan Anda."}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            Logo ditampilkan dalam grayscale agar preview mendekati hasil printer thermal.
          </p>
        </aside>
      </div>
    </section>
  );
}
