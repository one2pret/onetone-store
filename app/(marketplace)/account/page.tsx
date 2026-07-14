// app/(marketplace)/account/page.tsx — hub ringkasan
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getMyMembership } from '@/app/actions/membership';
import { getMyProfile } from '@/app/actions/profile';
import {
  User, Star, Coins, Tag, Package, MapPin, ChevronRight,
} from 'lucide-react';

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const TIER_STYLE: Record<string, string> = {
  Silver: 'bg-muted text-foreground',
  Gold: 'bg-premium text-premium-foreground',
  Platinum: 'bg-foreground text-background',
};

export default async function AccountPage() {
  const [profile, membership] = await Promise.all([
    getMyProfile(),
    getMyMembership(),
  ]);

  const tierStyle = membership
    ? (TIER_STYLE[membership.tier.name] ?? 'bg-muted text-foreground')
    : '';

  const quickLinks = [
    { href: '/account/profile', icon: User, label: 'Profil Saya', desc: 'Nama, telepon' },
    { href: '/account/membership', icon: Star, label: 'Membership', desc: membership ? `Tier ${membership.tier.name}` : 'Lihat benefit' },
    { href: '/account/points', icon: Coins, label: 'Poin Saya', desc: membership ? `${membership.points ?? 0} poin` : '—' },
    { href: '/account/vouchers', icon: Tag, label: 'Voucher', desc: 'Voucher aktif' },
    { href: '/orders', icon: Package, label: 'Pesanan Saya', desc: 'Riwayat order' },
    { href: '/addresses', icon: MapPin, label: 'Alamat Saya', desc: 'Buku alamat' },
  ];

  return (
    <div className="space-y-5">
      {/* Profile header card */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-bold shrink-0">
            {getInitials(profile?.name)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground text-base truncate">{profile?.name ?? '—'}</p>
            <p className="text-sm text-muted-foreground truncate">{profile?.email ?? '—'}</p>
            {membership && (
              <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full ${tierStyle}`}>
                <Star className="w-3 h-3" />
                {membership.tier.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Membership progress (if not max tier) */}
      {membership && membership.nextTier && (
        <Link href="/account/membership" className="block bg-card rounded-xl border border-border p-5 hover:border-primary/40 transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">Progress ke {membership.nextTier.name}</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
          </div>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${membership.progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <p className="text-xs text-muted-foreground">
              Rp {(membership.totalSpend ?? 0).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-muted-foreground">
              Rp {(membership.nextTier.minSpend ?? 0).toLocaleString('id-ID')}
            </p>
          </div>
        </Link>
      )}

      {/* Quick links grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {quickLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col gap-2 p-4 bg-card rounded-xl border border-border hover:border-primary/40 hover:bg-surface transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-surface group-hover:bg-card flex items-center justify-center transition">
              <item.icon className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground leading-tight">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Points summary if has membership */}
      {membership && (
        <Link href="/account/points" className="flex items-center justify-between bg-card rounded-xl border border-border p-5 hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
              <Coins className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Poin</p>
              <p className="text-xl font-bold text-foreground">{(membership.points ?? 0).toLocaleString('id-ID')}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
        </Link>
      )}
    </div>
  );
}
