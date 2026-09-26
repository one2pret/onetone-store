"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bluetooth, CheckCircle2, LockKeyhole, Printer, Smartphone } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import Image from "next/image";

type BrowserCapabilities = {
  android: boolean;
  secureContext: boolean;
  bluetoothApi: boolean;
};

interface Props {
  storeName: string | null;
  storePhone: string | null;
  storeAddress: string | null;
  receiptFooter: string | null;
  receiptLogoUrl: string | null;
}

export function PosPrintTest({ storeName, storePhone, storeAddress, receiptFooter, receiptLogoUrl }: Props) {
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);
  const [printedAt, setPrintedAt] = useState("-");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCapabilities({
        android: /Android/i.test(navigator.userAgent),
        secureContext: window.isSecureContext,
        bluetoothApi: "bluetooth" in navigator,
      });
      setPrintedAt(new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handlePrint() {
    window.print();
  }

  const displayName = storeName?.trim() || "ONETONE";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="print-hidden">
        <Link href="/pos" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke POS
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="print-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">BP-EC058 · 384 dot</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Test Print Struk 58 mm</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Tombol di bawah membuka dialog cetak sistem. Pada Android, printer hanya akan muncul jika Android Print Service yang mendukung Bluetooth ESC/POS sudah aktif.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <CapabilityCard
              icon={<Smartphone className="h-4 w-4" />}
              label="Perangkat Android"
              value={capabilities ? (capabilities.android ? "Terdeteksi" : "Tidak terdeteksi") : "Memeriksa..."}
              ready={capabilities?.android ?? false}
            />
            <CapabilityCard
              icon={<LockKeyhole className="h-4 w-4" />}
              label="Koneksi HTTPS"
              value={capabilities ? (capabilities.secureContext ? "Aman" : "Belum HTTPS") : "Memeriksa..."}
              ready={capabilities?.secureContext ?? false}
            />
            <CapabilityCard
              icon={<Bluetooth className="h-4 w-4" />}
              label="Web Bluetooth"
              value={capabilities ? (capabilities.bluetoothApi ? "Tersedia" : "Tidak tersedia") : "Memeriksa..."}
              ready={capabilities?.bluetoothApi ?? false}
            />
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Status Web Bluetooth hanya menunjukkan kemampuan browser. Cetak langsung tetap memerlukan kanal BLE/GATT printer yang kompatibel; untuk pengujian awal gunakan dialog cetak dan Android Print Service.
          </p>

          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Sebelum mencetak dari Android</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 leading-5">
              <li>Pair printer melalui pengaturan Bluetooth Android.</li>
              <li>Aktifkan print service yang mendukung Bluetooth ESC/POS di pengaturan Printing.</li>
              <li>Tekan tombol cetak dan pilih printer BP-EC058/RPPO2N.</li>
              <li>Pilih kertas 58 mm, margin nol, skala 100%, dan nonaktifkan header/footer.</li>
            </ol>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 sm:w-auto sm:min-w-56"
          >
            <Printer className="h-4 w-4" />
            Cetak Struk Percobaan
          </button>
        </section>

        <section className="rounded-2xl bg-slate-200/70 p-4 print:contents">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 print-hidden">
            Pratinjau 58 mm
          </p>
          <div id="print-receipt" className="mx-auto w-full max-w-[58mm] bg-white p-5 font-mono text-xs text-zinc-800 shadow-sm">
            <div className="border-b border-dashed border-zinc-300 pb-3 text-center">
              {receiptLogoUrl && (
                <Image
                  src={receiptLogoUrl}
                  alt={`Logo ${displayName}`}
                  width={160}
                  height={72}
                  unoptimized
                  className="mx-auto mb-2 max-h-14 w-auto object-contain grayscale"
                />
              )}
              <h2 className="text-base font-bold tracking-wide">{displayName}</h2>
              {storeAddress && <p className="mt-0.5 whitespace-pre-line text-[10px] text-zinc-500">{storeAddress}</p>}
              {storePhone && <p className="text-[10px] text-zinc-500">{storePhone}</p>}
              <p className="mt-1 text-[10px] font-semibold">TEST PRINT · BUKAN TRANSAKSI</p>
            </div>

            <div className="my-3 space-y-0.5 text-[11px]">
              <div className="flex justify-between gap-2"><span>Printer</span><span>BP-EC058</span></div>
              <div className="flex justify-between gap-2"><span>Lebar</span><span>48mm / 384 dot</span></div>
              <div className="flex justify-between gap-2"><span>Waktu</span><span>{printedAt}</span></div>
            </div>

            <div className="space-y-2 border-t border-dashed border-zinc-300 pt-2">
              <div data-receipt-item>
                <p className="font-semibold leading-tight">Produk Dengan Nama Panjang Untuk Uji Baris</p>
                <p className="text-[10px] text-zinc-500">XL / Midnight Black</p>
                <div className="mt-0.5 flex justify-between gap-2">
                  <span>2 × {formatRupiah(15_000)}</span>
                  <span className="font-semibold">{formatRupiah(30_000)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Diskon item</span><span>-{formatRupiah(3_000)}</span>
                </div>
              </div>
              <div data-receipt-item>
                <p className="font-semibold leading-tight">Produk Pendek</p>
                <div className="mt-0.5 flex justify-between gap-2">
                  <span>1 × {formatRupiah(10_000)}</span>
                  <span className="font-semibold">{formatRupiah(10_000)}</span>
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-1 border-t border-dashed border-zinc-300 pt-2 text-[11px]">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(40_000)}</span></div>
              <div className="flex justify-between"><span>Diskon</span><span>-{formatRupiah(5_000)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatRupiah(35_000)}</span></div>
              <div className="flex justify-between"><span>Bayar</span><span>TUNAI</span></div>
              <div className="flex justify-between"><span>Diterima</span><span>{formatRupiah(50_000)}</span></div>
              <div className="flex justify-between"><span>Kembalian</span><span>{formatRupiah(15_000)}</span></div>
            </div>

            <div className="mt-3 border-t border-dashed border-zinc-300 pt-3 text-center text-[10px] text-zinc-500 whitespace-pre-line">
              {receiptFooter?.trim() || "Terima kasih!\nHasil test harus terbaca dan tidak terpotong."}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function CapabilityCard({ icon, label, value, ready }: { icon: React.ReactNode; label: string; value: string; ready: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">{icon}{label}</div>
      <p className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${ready ? "text-emerald-700" : "text-slate-700"}`}>
        {ready && <CheckCircle2 className="h-4 w-4" />}
        {value}
      </p>
    </div>
  );
}
