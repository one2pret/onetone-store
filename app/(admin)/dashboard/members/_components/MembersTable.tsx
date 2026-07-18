// app/(admin)/dashboard/members/_components/MembersTable.tsx
'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { formatDate, formatRupiah } from '@/lib/utils';

type Member = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date | null;
  points: number | null;
  totalSpend: number | null;
  tierName: string | null;
  tierId: number | null;
};

interface Props {
  data: Member[];
}

const tierBadge: Record<string, string> = {
  Silver:   'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  Gold:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  Platinum: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
};

export function MembersTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Belum ada member</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 bg-muted/50 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nama</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Poin</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Total Belanja</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bergabung</span>
      </div>

      <div className="divide-y divide-border">
        {data.map((m) => (
          <Link
            key={m.id}
            href={`/dashboard/members/${m.id}`}
            className="flex flex-col md:grid md:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] gap-2 md:gap-4 items-start md:items-center px-4 md:px-6 py-4 hover:bg-muted/20 transition"
          >
            <div>
              <p className="font-medium text-foreground text-sm">{m.name}</p>
              {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
            </div>
            <span className="text-sm text-muted-foreground truncate">{m.email}</span>
            <span>
              {m.tierName ? (
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${tierBadge[m.tierName] ?? 'bg-muted text-muted-foreground'}`}>
                  {m.tierName}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">—</span>
              )}
            </span>
            <span className="text-sm text-foreground text-right">{(m.points ?? 0).toLocaleString('id')}</span>
            <span className="text-sm text-foreground text-right">{formatRupiah(m.totalSpend ?? 0)}</span>
            <span className="text-sm text-muted-foreground">{m.createdAt ? formatDate(m.createdAt) : '—'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
