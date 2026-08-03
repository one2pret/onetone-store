// app/(admin)/dashboard/affiliate/page.tsx — overview admin
import Link from 'next/link';
import { getAdminOverview } from '@/app/actions/affiliate';
import { formatRupiah } from '@/lib/utils';
import { Users, TrendingUp, Wallet, Clock } from 'lucide-react';

export default async function AdminAffiliateOverviewPage() {
  const stats = await getAdminOverview();

  const cards = [
    { icon: Users, label: 'Total Affiliate', value: stats.totalAffiliates, sub: `${stats.activeAffiliates} aktif` },
    { icon: Clock, label: 'Menunggu Review', value: stats.pendingAffiliates, sub: null },
    { icon: TrendingUp, label: 'GMV dari Affiliate', value: formatRupiah(stats.gmvFromAffiliates), sub: null },
    { icon: Wallet, label: 'Komisi Terutang', value: formatRupiah(stats.commissionOwed), sub: 'pending + holding + approved' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Affiliate</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Overview program affiliate</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl border border-border p-5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <c.icon className="w-4 h-4" />
              <p className="text-xs">{c.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
            {c.sub && <p className="text-[11px] text-muted-foreground">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: '/dashboard/affiliate/members', label: 'Kelola Affiliate' },
          { href: '/dashboard/affiliate/commissions', label: 'Semua Komisi' },
          { href: '/dashboard/affiliate/payouts', label: 'Antrian Withdraw' },
          { href: '/dashboard/affiliate/rules', label: 'Aturan Komisi' },
          { href: '/dashboard/affiliate/settings', label: 'Pengaturan' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-card rounded-xl border border-border p-4 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-surface transition-all"
          >
            {link.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
