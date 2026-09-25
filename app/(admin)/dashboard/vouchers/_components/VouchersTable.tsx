'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { Archive, Eye, Pencil, Power, TicketPercent, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteOrArchiveVoucher, toggleVoucherActive } from '@/app/actions/admin-vouchers';
import type { getAdminVouchers } from '@/app/actions/admin-vouchers';
import { Button } from '@/components/ui/button';
import { formatRupiah } from '@/lib/utils';

type VoucherRow = Awaited<ReturnType<typeof getAdminVouchers>>[number];

function valueLabel(voucher: VoucherRow) {
  if (voucher.type === 'free_shipping') return 'Gratis ongkir';
  if (voucher.type === 'percent') return `${voucher.value ?? 0}%`;
  return formatRupiah(voucher.value ?? 0);
}

const AUDIENCE_LABEL = {
  public: 'Publik',
  membership: 'Membership',
  new_user: 'Pengguna baru',
};

export function VouchersTable({ data }: { data: VoucherRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(id: number, active: boolean) {
    startTransition(async () => {
      const result = await toggleVoucherActive(id, active);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(active ? 'Voucher diaktifkan' : 'Voucher dinonaktifkan');
      router.refresh();
    });
  }

  function remove(id: number, code: string) {
    if (!window.confirm(`Hapus atau arsipkan voucher ${code}? Histori yang sudah ada tidak akan dihapus.`)) return;
    startTransition(async () => {
      const result = await deleteOrArchiveVoucher(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.mode === 'archived' ? 'Voucher diarsipkan karena memiliki histori' : 'Voucher dihapus');
      router.refresh();
    });
  }

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <TicketPercent className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">Belum ada voucher</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">Buat campaign pertama untuk mulai memberikan benefit.</p>
        <Button asChild size="sm"><Link href="/dashboard/vouchers/create">Voucher Baru</Link></Button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="hidden lg:grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.9fr_auto] gap-4 px-5 py-3 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground">
        <span>Campaign</span><span>Benefit</span><span>Audience</span><span>Pemakaian</span><span>Status</span><span className="sr-only">Aksi</span>
      </div>
      <div className="divide-y divide-border">
        {data.map((voucher) => {
          const archived = Boolean(voucher.archivedAt);
          return (
            <div key={voucher.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.9fr_auto] lg:items-center lg:px-5">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{voucher.name || voucher.code}</p>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">{voucher.code}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{valueLabel(voucher)}</p>
                <p className="text-xs text-muted-foreground">Min. {formatRupiah(voucher.minSpend ?? 0)}</p>
              </div>
              <span className="text-sm text-muted-foreground">{AUDIENCE_LABEL[voucher.audience]}</span>
              <div className="text-sm">
                <p className="text-foreground">{voucher.stats.redeemed} terbayar</p>
                <p className="text-xs text-muted-foreground">{voucher.stats.reserved} reserved</p>
              </div>
              <div>
                <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                  archived ? 'bg-muted text-muted-foreground' : voucher.isActive ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                }`}>
                  {archived ? 'Diarsipkan' : voucher.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="flex items-center gap-1" aria-busy={pending}>
                <Button variant="ghost" size="icon" asChild title="Lihat histori">
                  <Link href={`/dashboard/vouchers/${voucher.id}`}><Eye className="w-4 h-4" /></Link>
                </Button>
                {!archived && (
                  <>
                    <Button variant="ghost" size="icon" asChild title="Edit voucher">
                      <Link href={`/dashboard/vouchers/${voucher.id}/edit`}><Pencil className="w-4 h-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" disabled={pending} onClick={() => toggle(voucher.id, !voucher.isActive)} title={voucher.isActive ? 'Nonaktifkan' : 'Aktifkan'}>
                      <Power className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={pending} onClick={() => remove(voucher.id, voucher.code)} title="Hapus atau arsipkan">
                      {voucher.stats.orders || voucher.stats.granted ? <Archive className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
