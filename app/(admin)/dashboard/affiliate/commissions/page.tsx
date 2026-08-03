// app/(admin)/dashboard/affiliate/commissions/page.tsx
import Link from 'next/link';
import { getAllCommissions } from '@/app/actions/affiliate';
import { formatRupiah, formatDate, cn } from '@/lib/utils';
import { AdjustmentForm } from './AdjustmentForm';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-secondary text-secondary-foreground',
  holding: 'bg-warning/20 text-warning',
  approved: 'bg-success/20 text-success',
  paid: 'bg-secondary text-secondary-foreground',
  rejected: 'bg-destructive/20 text-destructive',
};

const FILTERS = [
  { value: undefined, label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'holding', label: 'Holding' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

export default async function AdminAffiliateCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const commissions = await getAllCommissions(status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Semua Komisi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{commissions.length} entri</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={f.value ? `/dashboard/affiliate/commissions?status=${f.value}` : '/dashboard/affiliate/commissions'}
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
        <AdjustmentForm />
      </div>

      {commissions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Tidak ada komisi di kategori ini.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Affiliate</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Order</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tipe</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Nominal</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/affiliate/members/${c.affiliateId}`} className="text-foreground hover:text-primary">
                      {c.affiliate?.displayName || c.affiliate?.code || `#${c.affiliateId}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">#{c.orderId}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{c.entryType}</td>
                  <td className={cn('px-4 py-3 text-right font-medium', Number(c.amount) < 0 ? 'text-destructive' : 'text-foreground')}>
                    {formatRupiah(c.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_STYLE[c.status])}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.createdAt!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
