import { Store, UserRoundPlus } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type PosCustomerLeadRow = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  status: 'pending' | 'activated' | 'cancelled' | 'expired';
  consentAt: Date;
  marketingConsentAt: Date | null;
  createdAt: Date;
  createdByName: string | null;
  locationName: string | null;
  claimedUserId: number | null;
};

const statusStyles: Record<PosCustomerLeadRow['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  activated: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-zinc-100 text-zinc-600',
  expired: 'bg-rose-100 text-rose-700',
};

const statusLabels: Record<PosCustomerLeadRow['status'], string> = {
  pending: 'Menunggu aktivasi',
  activated: 'Aktif',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
};

function displayPhone(phone: string) {
  return phone.startsWith('62') ? `+${phone}` : phone;
}

export function PosCustomerLeadsTable({ data }: { data: PosCustomerLeadRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 md:px-6">
        <div>
          <div className="flex items-center gap-2">
            <UserRoundPlus className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Calon member dari POS</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Data pelanggan yang didaftarkan kasir dan belum tentu mempunyai akun login.
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{data.length} data</span>
      </div>

      {data.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-muted-foreground">
          Belum ada calon member dari POS.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {data.map(lead => (
            <article key={lead.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.5fr_1.5fr_1.2fr_auto] md:items-center md:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{lead.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{displayPhone(lead.phone)}</p>
                {lead.email && <p className="truncate text-xs text-muted-foreground">{lead.email}</p>}
              </div>

              <div className="min-w-0 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 text-foreground">
                  <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{lead.locationName ?? 'Lokasi tidak tersedia'}</span>
                </p>
                <p className="mt-1 truncate">Kasir: {lead.createdByName ?? 'Tidak tersedia'}</p>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>Didaftarkan {formatDate(lead.createdAt)}</p>
                <p className="mt-1">Persetujuan data: tercatat</p>
                <p>Promo: {lead.marketingConsentAt ? 'setuju' : 'tidak'}</p>
              </div>

              <div className="md:text-right">
                <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${statusStyles[lead.status]}`}>
                  {statusLabels[lead.status]}
                </span>
                {lead.claimedUserId && <p className="mt-1 text-[10px] text-muted-foreground">User #{lead.claimedUserId}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
