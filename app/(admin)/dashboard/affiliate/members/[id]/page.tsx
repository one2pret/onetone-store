// app/(admin)/dashboard/affiliate/members/[id]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAffiliateDetail } from '@/app/actions/affiliate';
import { formatRupiah, formatDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SuspendForm } from './SuspendForm';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-secondary text-secondary-foreground',
  active: 'bg-success/20 text-success',
  suspended: 'bg-destructive/20 text-destructive',
  rejected: 'bg-destructive/20 text-destructive',
};

const COMMISSION_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-secondary text-secondary-foreground',
  holding: 'bg-warning/20 text-warning',
  approved: 'bg-success/20 text-success',
  paid: 'bg-secondary text-secondary-foreground',
  rejected: 'bg-destructive/20 text-destructive',
};

export default async function AdminAffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const affiliate = await getAffiliateDetail(Number(id));
  if (!affiliate) notFound();

  const social = affiliate.socialMedia ? JSON.parse(affiliate.socialMedia) : {};
  const totalEarned = affiliate.commissions
    .filter((c) => ['approved', 'paid'].includes(c.status))
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/affiliate/members" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3">
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{affiliate.displayName || affiliate.user?.name}</h1>
          <Badge className={STATUS_STYLE[affiliate.status]}>{affiliate.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {affiliate.user?.email} · Kode: <span className="font-mono">{affiliate.code}</span> · Tier: <span className="capitalize">{affiliate.tier}</span>
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted-foreground">Total Link</p>
          <p className="text-xl font-bold text-foreground">{affiliate.linkCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted-foreground">Total Earned (approved+paid)</p>
          <p className="text-xl font-bold text-foreground">{formatRupiah(totalEarned)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs text-muted-foreground">Audiens</p>
          <p className="text-xl font-bold text-foreground">{affiliate.audienceSize ?? '-'}</p>
        </div>
      </div>

      {(social.instagram || social.tiktok || social.youtube) && (
        <div className="bg-card rounded-xl border border-border p-5 flex gap-6 text-sm">
          {social.instagram && <div><p className="text-xs text-muted-foreground">Instagram</p><p className="text-foreground">{social.instagram}</p></div>}
          {social.tiktok && <div><p className="text-xs text-muted-foreground">TikTok</p><p className="text-foreground">{social.tiktok}</p></div>}
          {social.youtube && <div><p className="text-xs text-muted-foreground">YouTube</p><p className="text-foreground">{social.youtube}</p></div>}
        </div>
      )}

      {affiliate.status === 'active' && <SuspendForm affiliateId={affiliate.id} />}
      {affiliate.status === 'suspended' && affiliate.suspendReason && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          Dibekukan: {affiliate.suspendReason}
        </p>
      )}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Riwayat Komisi</p>
        {affiliate.commissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada komisi.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Order</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Nominal</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {affiliate.commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 text-foreground">#{c.orderId}</td>
                    <td className={cn('px-4 py-3 text-right font-medium', Number(c.amount) < 0 ? 'text-destructive' : 'text-foreground')}>
                      {formatRupiah(c.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={COMMISSION_STATUS_STYLE[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.createdAt!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Riwayat Penarikan</p>
        {affiliate.payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada penarikan.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nomor</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Nominal</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {affiliate.payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{p.payoutNumber}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">{formatRupiah(p.netAmount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
