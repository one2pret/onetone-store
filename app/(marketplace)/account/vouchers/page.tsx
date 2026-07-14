// app/(marketplace)/account/vouchers/page.tsx
import { getMyVouchers } from '@/app/actions/membership';
import { Tag, Copy } from 'lucide-react';
import { CopyButton } from './CopyButton';

function formatDate(d: Date | null) {
  if (!d) return null;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

const TYPE_LABEL: Record<string, string> = {
  fixed: 'Diskon',
  percent: 'Diskon %',
  free_shipping: 'Gratis Ongkir',
};

function formatValue(type: string, value: number) {
  if (type === 'fixed') return `Rp ${value.toLocaleString('id-ID')} off`;
  if (type === 'percent') return `${value}% off`;
  return 'Gratis ongkir';
}

export default async function VouchersPage() {
  const list = await getMyVouchers();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Voucher Saya</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{list.length} voucher tersedia</p>
      </div>

      {list.length === 0 ? (
        <div className="bg-card rounded-xl border border-border py-16 text-center">
          <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Tidak ada voucher aktif</p>
          <p className="text-xs text-muted-foreground mt-1">
            Voucher akan muncul setelah upgrade tier membership.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((v) => (
            <div
              key={v.id}
              className="bg-card rounded-xl border border-border overflow-hidden flex"
            >
              {/* Left accent */}
              <div className="w-1.5 shrink-0 bg-primary" />

              {/* Content */}
              <div className="flex-1 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {TYPE_LABEL[v.type] ?? v.type}
                      </span>
                      {v.tierId && (
                        <span className="px-1.5 py-0.5 bg-premium text-premium-foreground text-[10px] font-semibold rounded-full">
                          MEMBER
                        </span>
                      )}
                    </div>
                    <p className="text-base font-bold text-foreground">
                      {formatValue(v.type, v.value ?? 0)}
                    </p>
                    {(v.minSpend ?? 0) > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Min. belanja Rp {(v.minSpend ?? 0).toLocaleString('id-ID')}
                      </p>
                    )}
                    {v.endsAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Berlaku s/d {formatDate(v.endsAt)}
                      </p>
                    )}
                  </div>

                  {/* Code + copy */}
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2.5 py-1.5">
                      <span className="text-sm font-mono font-semibold text-foreground tracking-wider">
                        {v.code}
                      </span>
                      <CopyButton code={v.code} />
                    </div>
                    {v.quota !== null && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Sisa {v.quota - (v.usedCount ?? 0)} kali
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
