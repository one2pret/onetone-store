// app/(marketplace)/affiliate/dashboard/payouts/page.tsx
import { getMyAffiliate, getMyBalance, getMyPayouts, getAffiliateSettings } from '@/app/actions/affiliate';
import { formatRupiah, formatDate, cn } from '@/lib/utils';
import { PayoutRequestForm } from './PayoutRequestForm';

const STATUS_LABEL: Record<string, string> = {
  requested: 'Diajukan',
  approved: 'Disetujui',
  processing: 'Diproses',
  completed: 'Selesai',
  failed: 'Gagal',
  rejected: 'Ditolak',
};

const STATUS_STYLE: Record<string, string> = {
  requested: 'bg-secondary text-secondary-foreground',
  approved: 'bg-warning/20 text-warning',
  processing: 'bg-warning/20 text-warning',
  completed: 'bg-success/20 text-success',
  failed: 'bg-destructive/20 text-destructive',
  rejected: 'bg-destructive/20 text-destructive',
};

export default async function AffiliatePayoutsPage() {
  const affiliate = await getMyAffiliate();
  if (!affiliate) return null;

  const [balance, payouts, settings] = await Promise.all([
    getMyBalance(),
    getMyPayouts(),
    getAffiliateSettings(),
  ]);

  const minPayout = Number(settings?.minPayoutAmount ?? 50000);
  const hasBankAccount = !!(affiliate.bankCode && affiliate.bankAccountNumber && affiliate.bankAccountName);
  const hasPendingPayout = payouts.some((p) => ['requested', 'approved', 'processing'].includes(p.status));
  const canRequest = hasBankAccount && !hasPendingPayout && balance.saldoTersedia >= minPayout;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Penarikan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ajukan penarikan saldo komisi ke rekeningmu</p>
      </div>

      {!hasBankAccount && (
        <p className="text-sm text-warning bg-warning/10 border border-warning/20 rounded-lg px-4 py-3">
          Lengkapi data rekening di halaman Pengaturan sebelum bisa menarik saldo.
        </p>
      )}

      <PayoutRequestForm saldoTersedia={balance.saldoTersedia} minPayout={minPayout} canRequest={canRequest} />

      {payouts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Belum ada riwayat penarikan.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nomor</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Nominal</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{p.payoutNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.createdAt!)}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{formatRupiah(p.netAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_STYLE[p.status])}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
