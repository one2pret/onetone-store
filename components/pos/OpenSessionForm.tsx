"use client";

// components/pos/OpenSessionForm.tsx
// Form buka sesi kasir — input modal awal (uang di laci).
// Ini tampil kalau kasir belum punya sesi aktif.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { openSession } from "@/app/actions/pos-sessions";
import { formatRupiah } from "@/lib/utils";
import { Calculator, Wallet, User } from "lucide-react";

const QUICK_AMOUNTS = [0, 50000, 100000, 200000, 500000, 1000000];

interface CashierOption {
  id: number;
  name: string;
  email: string;
}

interface Props {
  cashierName?: string;
  currentUserId?: number;
  cashiers?: CashierOption[];
}

export function OpenSessionForm({ cashierName, currentUserId, cashiers = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openingCash, setOpeningCash] = useState<string>("0");
  const [notes, setNotes] = useState("");
  const [selectedCashierId, setSelectedCashierId] = useState<number>(currentUserId ?? 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(openingCash);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error("Modal awal tidak valid");
      return;
    }

    startTransition(async () => {
      const result = await openSession({
        openingCash: amount,
        notes: notes || undefined,
        cashierId: selectedCashierId || undefined,
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
            Pilih kasir yang bertugas dan masukkan modal awal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pilih kasir */}
          {cashiers.length > 0 && (
            <div>
              <label htmlFor="cashierId" className="block text-sm font-medium text-slate-700 mb-2">
                <User className="w-4 h-4 inline mr-1 -mt-0.5" />
                Kasir Bertugas
              </label>
              <select
                id="cashierId"
                value={selectedCashierId}
                onChange={(e) => setSelectedCashierId(Number(e.target.value))}
                className="w-full px-4 py-3 text-base font-medium bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition appearance-none"
              >
                {cashiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.id === currentUserId ? ' (Anda)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

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
            disabled={isPending}
            className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isPending ? "Membuka..." : "Mulai Sesi Kasir"}
          </button>
        </form>
      </div>
    </div>
  );
}
