import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getAdminVouchers } from '@/app/actions/admin-vouchers';
import { Button } from '@/components/ui/button';
import { VouchersTable } from './_components/VouchersTable';

export default async function AdminVouchersPage() {
  const vouchers = await getAdminVouchers();
  const active = vouchers.filter((voucher) => voucher.isActive && !voucher.archivedAt).length;
  const redeemed = vouchers.reduce((total, voucher) => total + voucher.stats.redeemed, 0);
  const reserved = vouchers.reduce((total, voucher) => total + voucher.stats.reserved, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Voucher</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola campaign, aturan pemakaian, dan histori voucher.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/vouchers/create">
            <Plus className="w-4 h-4 mr-1.5" />
            Voucher Baru
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 border border-border rounded-xl overflow-hidden bg-card">
        <div className="px-4 py-3 border-r border-border">
          <p className="text-xs text-muted-foreground">Campaign aktif</p>
          <p className="text-xl font-semibold text-foreground mt-1">{active}</p>
        </div>
        <div className="px-4 py-3 border-r border-border">
          <p className="text-xs text-muted-foreground">Sedang direservasi</p>
          <p className="text-xl font-semibold text-foreground mt-1">{reserved}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Order terbayar</p>
          <p className="text-xl font-semibold text-foreground mt-1">{redeemed}</p>
        </div>
      </div>

      <VouchersTable data={vouchers} />
    </div>
  );
}
