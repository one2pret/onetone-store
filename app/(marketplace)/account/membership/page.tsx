// app/(marketplace)/account/membership/page.tsx
import { getMyMembership } from '@/app/actions/membership';
import { Star, Check } from 'lucide-react';

const TIER_STYLE: Record<string, { badge: string; bar: string }> = {
  Silver: { badge: 'bg-muted text-foreground border border-border', bar: 'bg-muted-foreground' },
  Gold:   { badge: 'bg-premium text-premium-foreground',            bar: 'bg-premium' },
  Platinum: { badge: 'bg-foreground text-background',               bar: 'bg-foreground' },
};

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export default async function MembershipPage() {
  const membership = await getMyMembership();

  if (!membership) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Membership</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Status keanggotaan dan benefit aktif</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
            <Star className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Belum terdaftar sebagai member</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Buat pesanan pertama untuk otomatis bergabung sebagai member Silver dan mulai kumpulkan poin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { tier, nextTier, progressPct, allTiers, totalSpend } = membership;
  const style = TIER_STYLE[tier.name] ?? TIER_STYLE.Silver;

  const benefits = [
    (tier.discountPct ?? 0) > 0 && `Diskon ${tier.discountPct}% untuk setiap pembelian`,
    tier.freeShippingThreshold === 0 && 'Gratis ongkir untuk semua pesanan',
    tier.freeShippingThreshold !== null && (tier.freeShippingThreshold ?? 0) > 0 &&
      `Gratis ongkir untuk pesanan di atas ${formatRp(tier.freeShippingThreshold!)}`,
    `${tier.pointMultiplier ?? 1}x poin untuk setiap pembelian`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Membership</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Status keanggotaan dan benefit aktif</p>
      </div>

      {/* Current tier card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tier Saat Ini</p>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded-full ${style.badge}`}>
              <Star className="w-3.5 h-3.5" />
              {tier.name}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Total Belanja</p>
            <p className="text-base font-bold text-foreground">{formatRp(totalSpend ?? 0)}</p>
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-2 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Benefit Aktif</p>
          {benefits.length > 0 ? (
            <ul className="space-y-2 mt-2">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Upgrade tier untuk mendapat benefit.</p>
          )}
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm font-medium text-foreground mb-3">
            Progress ke Tier {nextTier.name}
          </p>
          <div className="h-2 bg-surface rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${style.bar} rounded-full transition-all duration-700`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatRp(totalSpend ?? 0)}</span>
            <span>{progressPct}% · {formatRp(nextTier.minSpend ?? 0)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Butuh {formatRp(Math.max(0, (nextTier.minSpend ?? 0) - (totalSpend ?? 0)))} lagi untuk naik tier.
          </p>
        </div>
      )}

      {/* All tiers overview */}
      <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
        <div className="px-5 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Semua Tier</p>
        </div>
        {allTiers.map((t) => {
          const isCurrent = t.id === tier.id;
          const ts = TIER_STYLE[t.name] ?? TIER_STYLE.Silver;
          return (
            <div key={t.id} className={`px-5 py-4 flex items-center justify-between ${isCurrent ? 'bg-surface' : ''}`}>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${ts.badge}`}>
                  <Star className="w-3 h-3" />
                  {t.name}
                </span>
                {isCurrent && (
                  <span className="text-[10px] font-medium text-muted-foreground">Tier kamu</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {(t.minSpend ?? 0) === 0 ? 'Gratis bergabung' : `Min. ${formatRp(t.minSpend ?? 0)}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
