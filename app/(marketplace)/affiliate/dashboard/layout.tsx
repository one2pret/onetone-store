// app/(marketplace)/affiliate/dashboard/layout.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getMyAffiliate } from '@/app/actions/affiliate';
import { AffiliateDashboardNav } from './AffiliateDashboardNav';
import { Clock } from 'lucide-react';

export default async function AffiliateDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/affiliate/dashboard');

  const affiliate = await getMyAffiliate();
  if (!affiliate) redirect('/affiliate');

  if (affiliate.status === 'pending') {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-card rounded-xl border border-border p-8 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Pendaftaran sedang direview</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Tim kami akan menghubungimu setelah pendaftaran affiliate disetujui. Biasanya 1-2 hari kerja.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (affiliate.status === 'suspended' || affiliate.status === 'rejected') {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-card rounded-xl border border-border p-8 flex flex-col items-center text-center gap-3">
          <p className="text-sm font-semibold text-foreground">
            {affiliate.status === 'suspended' ? 'Akun affiliate dibekukan' : 'Pendaftaran tidak disetujui'}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {affiliate.suspendReason || 'Hubungi admin untuk informasi lebih lanjut.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="flex gap-6 md:gap-8 items-start">
          <aside className="hidden md:block w-52 shrink-0 sticky top-24">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
              Affiliate
            </p>
            <AffiliateDashboardNav />
          </aside>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
