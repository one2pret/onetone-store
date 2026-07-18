// app/(admin)/dashboard/members/[id]/page.tsx
import { getMember, getMemberOrders } from '@/app/actions/members';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { formatRupiah, formatDate } from '@/lib/utils';

const tierBadge: Record<string, string> = {
  Silver:   'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  Gold:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  Platinum: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
};

const statusLabel: Record<string, string> = {
  waiting_payment: 'Menunggu Bayar',
  packing: 'Dikemas',
  shipping: 'Dikirim',
  delivered: 'Selesai',
  cancelled: 'Dibatalkan',
  expired: 'Kadaluarsa',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MemberDetailPage({ params }: Props) {
  const { id } = await params;
  const [member, recentOrders] = await Promise.all([
    getMember(Number(id)),
    getMemberOrders(Number(id)),
  ]);

  if (!member) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/members" className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{member.name}</h1>
          <p className="text-sm text-muted-foreground">{member.email}</p>
        </div>
        {member.tierName && (
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold ${tierBadge[member.tierName] ?? 'bg-muted text-muted-foreground'}`}>
            {member.tierName}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Belanja', value: formatRupiah(member.totalSpend ?? 0) },
          { label: 'Total Pesanan', value: String(member.orderCount) },
          { label: 'Poin Aktif', value: (member.points ?? 0).toLocaleString('id') },
          { label: 'Bergabung', value: member.createdAt ? formatDate(member.createdAt) : '—' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Profile */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground mb-4">Profil</h2>
        {[
          { label: 'No. HP', value: member.phone || '—' },
          { label: 'Tanggal Lahir', value: member.birthdate || '—' },
          { label: 'Alamat', value: member.address || '—' },
          { label: 'Member Sejak', value: member.joinedAt ? formatDate(member.joinedAt) : '—' },
          { label: 'Diskon Tier', value: member.tierDiscountPct ? `${member.tierDiscountPct}%` : '—' },
        ].map((row) => (
          <div key={row.label} className="flex gap-4 text-sm">
            <span className="w-32 text-muted-foreground shrink-0">{row.label}</span>
            <span className="text-foreground">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">10 Pesanan Terakhir</h2>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada pesanan</p>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((o) => (
              <Link
                key={o.id}
                href={`/dashboard/orders/${o.id}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{o.createdAt ? formatDate(o.createdAt) : '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{formatRupiah(Number(o.total))}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel[o.status ?? ''] ?? o.status}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
