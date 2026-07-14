// app/(marketplace)/account/points/page.tsx
import { getMyPoints } from '@/app/actions/membership';
import { Coins, TrendingUp, TrendingDown } from 'lucide-react';
import { notFound } from 'next/navigation';

function formatDate(d: Date | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

const REASON_LABEL: Record<string, string> = {
  order_earn: 'Dari Pembelian',
  order_redeem: 'Ditukar di Checkout',
  manual_adjust: 'Penyesuaian Manual',
};

export default async function PointsPage() {
  const data = await getMyPoints();
  if (!data) notFound();

  const { balance, ledger } = data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Poin Saya</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Saldo poin dan riwayat transaksi</p>
      </div>

      {/* Balance card */}
      <div className="bg-card rounded-xl border border-border p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center shrink-0">
          <Coins className="w-6 h-6 text-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Poin</p>
          <p className="text-3xl font-bold text-foreground tracking-tight">
            {balance.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            ≈ Rp {(balance * 100).toLocaleString('id-ID')} nilai tukar
          </p>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Riwayat Transaksi
          </p>
        </div>

        {ledger.length === 0 ? (
          <div className="py-12 text-center">
            <Coins className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada transaksi poin.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {ledger.map((entry) => {
              const isEarn = entry.delta > 0;
              return (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isEarn ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {isEarn
                        ? <TrendingUp className="w-4 h-4" />
                        : <TrendingDown className="w-4 h-4" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {REASON_LABEL[entry.reason ?? ''] ?? entry.reason ?? 'Transaksi'}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${isEarn ? 'text-success' : 'text-destructive'}`}>
                    {isEarn ? '+' : ''}{entry.delta.toLocaleString('id-ID')}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
