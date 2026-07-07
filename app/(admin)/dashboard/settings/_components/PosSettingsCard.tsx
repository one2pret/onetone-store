"use client";

// app/(admin)/dashboard/settings/_components/PosSettingsCard.tsx
// Section pengaturan POS: upload gambar QRIS statis + edit footer struk.

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QrCode, Upload, Trash2, Save } from "lucide-react";
import { uploadPosQris, removePosQris, updateReceiptFooter } from "@/app/actions/pos-settings";

interface Props {
  qrisUrl: string | null;
  receiptFooter: string | null;
}

export function PosSettingsCard({ qrisUrl, receiptFooter }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [isSavingFooter, startSaveFooter] = useTransition();
  const [footer, setFooter] = useState(receiptFooter ?? "");
  const [currentQrisUrl, setCurrentQrisUrl] = useState(qrisUrl);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      toast.error("File harus gambar, maksimal 10MB");
      return;
    }

    const fd = new FormData();
    fd.append("image", file);

    startUpload(async () => {
      const result = await uploadPosQris(fd);
      if (result.success && result.url) {
        setCurrentQrisUrl(result.url);
        toast.success("QRIS berhasil diupload");
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal upload QRIS");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleRemove() {
    if (!confirm("Hapus gambar QRIS?")) return;
    startUpload(async () => {
      const result = await removePosQris();
      if (result.success) {
        setCurrentQrisUrl(null);
        toast.success("QRIS dihapus");
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal hapus");
      }
    });
  }

  function handleSaveFooter() {
    startSaveFooter(async () => {
      const result = await updateReceiptFooter(footer);
      if (result.success) {
        toast.success("Footer struk disimpan");
      } else {
        toast.error(result.error ?? "Gagal simpan");
      }
    });
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <QrCode className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Pengaturan POS</h2>
          <p className="text-xs text-muted-foreground">
            Gambar QRIS statis dan footer struk kasir
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* QRIS upload */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Gambar QRIS Statis
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            QRIS merchant dari bank/e-wallet. Ditampilkan ke customer saat pilih QRIS di kasir.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {currentQrisUrl ? (
            <div className="space-y-2">
              <div className="relative aspect-square max-w-[240px] bg-white border border-border rounded-xl overflow-hidden">
                <Image
                  src={currentQrisUrl}
                  alt="QRIS"
                  fill
                  unoptimized
                  sizes="240px"
                  className="object-contain p-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Ganti
                </button>
                <button
                  onClick={handleRemove}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 border border-border rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full max-w-[240px] aspect-square border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition disabled:opacity-50 flex flex-col items-center justify-center gap-2 text-muted-foreground"
            >
              <Upload className="w-8 h-8" />
              <span className="text-xs font-medium">
                {isUploading ? "Mengupload..." : "Upload Gambar QRIS"}
              </span>
              <span className="text-[10px]">JPG, PNG, WebP — Maks 10MB</span>
            </button>
          )}
        </div>

        {/* Receipt footer */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Footer Struk
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            Teks yang muncul di bawah struk. Bisa untuk terima kasih, info retur, medsos, dll.
          </p>
          <textarea
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            rows={6}
            maxLength={500}
            placeholder={"Contoh:\nTerima kasih atas kunjungan Anda!\nIkuti kami di @onetone.official\nRetur maks 7 hari + struk."}
            className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none font-mono"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-muted-foreground">
              {footer.length}/500 karakter
            </p>
            <button
              onClick={handleSaveFooter}
              disabled={isSavingFooter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingFooter ? "Menyimpan..." : "Simpan Footer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
