import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getAdminVoucher, getVoucherHistory } from '@/app/actions/admin-vouchers';
import { getMemberTiers } from '@/app/actions/members';
import { VoucherForm } from '../../_components/VoucherForm';

export default async function EditVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const voucherId = Number(id);
  const [voucher, history, tiers] = await Promise.all([getAdminVoucher(voucherId), getVoucherHistory(voucherId), getMemberTiers()]);
  if (!voucher) notFound();
  const hasHistory = Boolean(history && (history.grants.length > 0 || history.orders.length > 0));
  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/vouchers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" />Kembali ke Voucher</Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground mt-3">Edit {voucher.code}</h1>
        <p className="text-sm text-muted-foreground mt-1">Perubahan berlaku untuk checkout berikutnya.</p>
      </div>
      <VoucherForm voucher={voucher} tiers={tiers} hasHistory={hasHistory} />
    </div>
  );
}
