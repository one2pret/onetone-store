import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Pencil } from 'lucide-react';
import { getVoucherHistory } from '@/app/actions/admin-vouchers';
import { Button } from '@/components/ui/button';
import { formatRupiah } from '@/lib/utils';

function maskEmail(email: string | null) {
  if (!email) return 'Tidak tersedia';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function formatDate(value: Date | null) {
  if (!value) return 'Belum ada';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

const STATUS_LABEL: Record<string, string> = {
  available: 'Tersedia', reserved: 'Reserved', redeemed: 'Digunakan', expired: 'Kedaluwarsa',
  waiting_payment: 'Menunggu pembayaran', packing: 'Dikemas', shipping: 'Dikirim', delivered: 'Selesai', cancelled: 'Dibatalkan',
};

export default async function VoucherHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await getVoucherHistory(Number(id));
  if (!history) notFound();
  const { voucher, grants, orders } = history;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard/vouchers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" />Kembali ke Voucher</Link>
          <h1 className="text-xl md:text-2xl font-bold text-foreground mt-3">{voucher.name || voucher.code}</h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">{voucher.code}</p>
        </div>
        {!voucher.archivedAt && <Button asChild size="sm" variant="outline"><Link href={`/dashboard/vouchers/${voucher.id}/edit`}><Pencil className="w-4 h-4 mr-1.5" />Edit Voucher</Link></Button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 border border-border rounded-xl overflow-hidden bg-card">
        <div className="p-4 border-r border-b md:border-b-0 border-border"><p className="text-xs text-muted-foreground">Diberikan</p><p className="text-xl font-semibold mt-1">{grants.length}</p></div>
        <div className="p-4 border-b md:border-b-0 md:border-r border-border"><p className="text-xs text-muted-foreground">Order</p><p className="text-xl font-semibold mt-1">{orders.length}</p></div>
        <div className="p-4 border-r border-border"><p className="text-xs text-muted-foreground">Total diskon</p><p className="text-xl font-semibold mt-1">{formatRupiah(orders.reduce((sum, order) => sum + Number(order.discountAmount ?? 0), 0))}</p></div>
        <div className="p-4"><p className="text-xs text-muted-foreground">Status</p><p className="text-sm font-semibold mt-2">{voucher.archivedAt ? 'Diarsipkan' : voucher.isActive ? 'Aktif' : 'Nonaktif'}</p></div>
      </div>

      <section className="space-y-3">
        <div><h2 className="text-base font-semibold text-foreground">Histori order</h2><p className="text-xs text-muted-foreground mt-0.5">Maksimal 100 aktivitas terbaru. Email dimasking.</p></div>
        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          {orders.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Belum ada order yang menggunakan voucher ini.</p> : (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Diskon</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Waktu</th></tr></thead>
              <tbody className="divide-y divide-border">{orders.map((order) => <tr key={order.id}><td className="px-4 py-3"><Link href={`/dashboard/orders/${order.id}`} className="font-mono font-medium text-primary hover:underline">{order.orderNumber}</Link></td><td className="px-4 py-3"><p className="text-foreground">{order.userName || 'Customer'}</p><p className="text-xs text-muted-foreground">{maskEmail(order.userEmail)}</p></td><td className="px-4 py-3">{STATUS_LABEL[order.status ?? ''] ?? order.status}</td><td className="px-4 py-3">{formatRupiah(order.discountAmount ?? 0)}</td><td className="px-4 py-3">{formatRupiah(order.total)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(order.paidAt ?? order.createdAt)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </section>

      {voucher.audience === 'new_user' && (
        <section className="space-y-3">
          <div><h2 className="text-base font-semibold text-foreground">Histori pemberian</h2><p className="text-xs text-muted-foreground mt-0.5">Lifecycle voucher personal dari tersedia sampai digunakan atau kedaluwarsa.</p></div>
          <div className="border border-border rounded-xl overflow-x-auto bg-card">
            {grants.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Belum ada voucher yang diberikan.</p> : (
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Diberikan</th><th className="px-4 py-3">Kedaluwarsa</th><th className="px-4 py-3">Aktivitas terakhir</th></tr></thead>
                <tbody className="divide-y divide-border">{grants.map((grant) => <tr key={grant.id}><td className="px-4 py-3"><p className="text-foreground">{grant.userName || 'Customer'}</p><p className="text-xs text-muted-foreground">{maskEmail(grant.userEmail)}</p></td><td className="px-4 py-3">{STATUS_LABEL[grant.status] ?? grant.status}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(grant.grantedAt)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(grant.expiresAt)}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(grant.redeemedAt ?? grant.reservedAt ?? grant.grantedAt)}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
