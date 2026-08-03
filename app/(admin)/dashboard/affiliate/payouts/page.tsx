// app/(admin)/dashboard/affiliate/payouts/page.tsx
import Link from 'next/link';
import { getAllPayouts } from '@/app/actions/affiliate';
import { formatRupiah, formatDate, cn } from '@/lib/utils';
import { PayoutActions } from './PayoutActions';

const STATUS_STYLE: Record<string, string> = {
  requested: 'bg-secondary text-secondary-foreground',
  approved: 'bg-warning/20 text-warning',
  processing: 'bg-warning/20 text-warning',
  completed: 'bg-success/20 text-success',
  failed: 'bg-destructive/20 text-destructive',
  rejected: 'bg-destructive/20 text-destructive',
};

const FILTERS = [
  { value: undefined, label: 'Semua' },
  { value: 'requested', label: 'Diajukan' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'completed', label: 'Selesai' },
  { value: 'rejected', label: 'Ditolak' },
];

export default async function AdminAffiliatePayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const payouts = await getAllPayouts(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Antrian Withdraw</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{payouts.length} permintaan</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/dashboard/affiliate/payouts?status=${f.value}` : '/dashboard/affiliate/payouts'}
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

      {payouts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Tidak ada permintaan withdraw.</p>
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => (
            <div key={p.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs text-foreground">{p.payoutNumber}</p>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_STYLE[p.status])}>{p.status}</span>
                </div>
                <p className="text-sm text-foreground mt-1">
                  <Link href={`/dashboard/affiliate/members/${p.affiliateId}`} className="hover:text-primary">
                    {p.affiliate?.displayName || p.affiliate?.code}
                  </Link>
                  {' — '}{formatRupiah(p.netAmount)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.bankCode} {p.bankAccountNumber} a/n {p.bankAccountName} · {formatDate(p.createdAt!)}
                </p>
              </div>
              <PayoutActions id={p.id} status={p.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
