// app/(marketplace)/affiliate/dashboard/commissions/page.tsx
import Link from 'next/link';
import { getMyCommissions } from '@/app/actions/affiliate';
import { formatRupiah, formatDate, cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu Bayar',
  holding: 'Masa Tunggu',
  approved: 'Disetujui',
  paid: 'Sudah Ditarik',
  rejected: 'Ditolak',
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-secondary text-secondary-foreground',
  holding: 'bg-warning/20 text-warning',
  approved: 'bg-success/20 text-success',
  paid: 'bg-secondary text-secondary-foreground',
  rejected: 'bg-destructive/20 text-destructive',
};

const FILTERS = [
  { value: undefined, label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'holding', label: 'Masa Tunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'paid', label: 'Ditarik' },
  { value: 'rejected', label: 'Ditolak' },
];

export default async function AffiliateCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const commissions = await getMyCommissions(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Komisi</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Riwayat komisi dari setiap pesanan</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/affiliate/dashboard/commissions?status=${f.value}` : '/affiliate/dashboard/commissions'}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition',
              status === f.value || (!status && !f.value)
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {commissions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Belum ada komisi di kategori ini.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Order</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Rate</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Komisi</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.createdAt!)}</td>
                  <td className="px-4 py-3 text-foreground">#{c.orderId}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{Number(c.ratePercent)}%</td>
                  <td className={cn('px-4 py-3 text-right font-medium', Number(c.amount) < 0 ? 'text-destructive' : 'text-foreground')}>
                    {formatRupiah(c.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_STYLE[c.status])}>
                      {STATUS_LABEL[c.status]}
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
