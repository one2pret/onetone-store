import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getMemberTiers } from '@/app/actions/members';
import { VoucherForm } from '../_components/VoucherForm';

export default async function CreateVoucherPage() {
  const tiers = await getMemberTiers();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/vouchers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" />Kembali ke Voucher</Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground mt-3">Voucher Baru</h1>
        <p className="text-sm text-muted-foreground mt-1">Atur benefit, audience, batas penggunaan, dan jadwal campaign.</p>
      </div>
      <VoucherForm tiers={tiers} />
    </div>
  );
}
