"use client";

// components/pos/OpenSessionForm.tsx
// Form buka sesi kasir — input modal awal (uang di laci).
// Ini tampil kalau kasir belum punya sesi aktif.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { openSession } from "@/app/actions/pos-sessions";
import { formatRupiah } from "@/lib/utils";
import { Calculator, Printer, Wallet, User } from "lucide-react";

const QUICK_AMOUNTS = [0, 50000, 100000, 200000, 500000, 1000000];

interface Props {
  cashierName?: string;
  locations: { id: number; name: string; code: string }[];
}

export function OpenSessionForm({ cashierName, locations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openingCash, setOpeningCash] = useState<string>("0");
  const [notes, setNotes] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(openingCash);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error("Modal awal tidak valid");
      return;
    }

    startTransition(async () => {
      const result = await openSession({
        locationId,
        openingCash: amount,
        notes: notes || undefined,
      });
      if (result.success) {
        toast.success("Sesi kasir dibuka");
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal buka sesi");
      }
    });
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Calculator className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Buka Kasir</h1>
          <p className="text-sm text-slate-500 mt-1">
            Masuk sebagai {cashierName || "kasir"} dan masukkan modal awal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <User className="h-4 w-4 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Kasir bertugas</p>
              <p className="text-sm font-semibold text-slate-800">{cashierName || "Akun kasir"}</p>
            </div>
          </div>

          <div>
            <label htmlFor="locationId" className="mb-2 block text-sm font-medium text-slate-700">Lokasi stok POS</label>
            <select id="locationId" value={locationId} onChange={e => setLocationId(Number(e.target.value))} required className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:border-primary">
              {locations.length === 0 && <option value={0}>Belum ada lokasi POS aktif</option>}
              {locations.map(location => <option key={location.id} value={location.id}>{location.name} · {location.code}</option>)}
            </select>
          </div>

          {/* Modal awal */}
          <div>
            <label htmlFor="openingCash" className="block text-sm font-medium text-slate-700 mb-2">
              <Wallet className="w-4 h-4 inline mr-1 -mt-0.5" />
              Modal Awal (Rp)
            </label>
            <input
              id="openingCash"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full px-4 py-3 text-lg font-semibold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              placeholder="0"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {formatRupiah(Number(openingCash) || 0)}
            </p>

            {/* Quick amounts */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setOpeningCash(String(amt))}
                  className="px-2 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-primary/10 hover:text-primary transition"
                >
                  {amt === 0 ? "Kosong" : formatRupiah(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2">
              Catatan (opsional)
            </label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
              placeholder="Misal: shift pagi, kasir A"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !locationId}
            className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isPending ? "Membuka..." : "Mulai Sesi Kasir"}
          </button>
          <Link
            href="/pos/test-print"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Test Print 58 mm
          </Link>
        </form>
      </div>
    </div>
  );
}
