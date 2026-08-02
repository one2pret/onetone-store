// app/(marketplace)/affiliate/dashboard/page.tsx — ringkasan: saldo, klik, konversi
import Link from 'next/link';
import { getMyAffiliate, getMyBalance, getMyStats } from '@/app/actions/affiliate';
import { formatRupiah } from '@/lib/utils';
import { Wallet, MousePointerClick, TrendingUp, Copy } from 'lucide-react';
import { CopyCodeButton } from './CopyCodeButton';

// Gold cuma untuk badge tier (docs/design-system/01-color-tokens.md) — bukan aksen umum.
const TIER_STYLE: Record<string, string> = {
  starter: 'bg-secondary text-secondary-foreground',
  pro: 'bg-foreground text-background',
  elite: 'bg-premium text-premium-foreground',
};
const TIER_LABEL: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  elite: 'Elite',
};

export default async function AffiliateDashboardPage() {
  const affiliate = await getMyAffiliate();
  if (!affiliate) return null;

  const [balance, stats] = await Promise.all([getMyBalance(), getMyStats()]);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-foreground">Ringkasan</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TIER_STYLE[affiliate.tier]}`}>
              {TIER_LABEL[affiliate.tier]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Kode kamu: <span className="font-mono text-foreground">{affiliate.code}</span></p>
        </div>
        <CopyCodeButton text={`${baseUrl}/?ref=${affiliate.code}`} />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="w-4 h-4" />
            <p className="text-xs">Saldo Tersedia</p>
          </div>
          <p className="text-xl font-bold text-foreground">{formatRupiah(balance.saldoTersedia)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="w-4 h-4" />
            <p className="text-xs">Saldo Tertahan</p>
          </div>
          <p className="text-xl font-bold text-foreground">{formatRupiah(balance.saldoTertahan)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="w-4 h-4" />
            <p className="text-xs">Total Ditarik</p>
          </div>
          <p className="text-xl font-bold text-foreground">{formatRupiah(balance.totalDitarik)}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MousePointerClick className="w-4 h-4" />
            <p className="text-xs">Total Klik</p>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.totalClicks}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            <p className="text-xs">Konversi</p>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.totalConversions}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            <p className="text-xs">Conversion Rate</p>
          </div>
          <p className="text-xl font-bold text-foreground">{stats.conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Belum punya link khusus?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Buat link produk atau kategori spesifik di halaman Link Saya.</p>
        </div>
        <Link href="/affiliate/dashboard/links" className="text-sm text-primary hover:text-primary-hover font-medium">
          Buat Link →
        </Link>
      </div>
    </div>
  );
}
