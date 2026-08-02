// app/(marketplace)/affiliate/page.tsx — landing publik, tidak butuh login
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getMyAffiliate, getAffiliateSettings } from '@/app/actions/affiliate';
import { Button } from '@/components/ui/button';
import { Link2, Wallet, TrendingUp, ShieldCheck } from 'lucide-react';

export default async function AffiliateLandingPage() {
  const session = await auth();
  const settings = await getAffiliateSettings();
  const myAffiliate = session?.user ? await getMyAffiliate() : null;

  const defaultRate = Number(settings?.defaultRatePercent ?? 5);
  const cookieWindowDays = settings?.cookieWindowDays ?? 30;
  const minPayout = Number(settings?.minPayoutAmount ?? 50000);

  let ctaHref = '/affiliate/register';
  let ctaLabel = 'Daftar Jadi Affiliate';
  if (myAffiliate) {
    if (myAffiliate.status === 'active') {
      ctaHref = '/affiliate/dashboard';
      ctaLabel = 'Buka Dashboard';
    } else if (myAffiliate.status === 'pending') {
      ctaHref = '/affiliate/dashboard';
      ctaLabel = 'Cek Status Pendaftaran';
    }
  } else if (!session?.user) {
    ctaHref = '/login?redirect=/affiliate/register';
  }

  const steps = [
    { icon: Link2, title: 'Dapat link unik', desc: 'Setelah disetujui, kamu dapat kode dan link referral sendiri.' },
    { icon: TrendingUp, title: 'Share & bawa pembeli', desc: 'Bagikan link ke IG, TikTok, atau WA. Setiap klik tercatat 30 hari.' },
    { icon: Wallet, title: 'Dapat komisi', desc: `Mulai ${defaultRate}% dari setiap pesanan yang selesai lewat linkmu.` },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-10">
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          Jadi Affiliate Onetone
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-xl">
          Bagikan produk Onetone lewat link sendiri, dapat komisi dari setiap pesanan yang selesai.
          Tidak ada biaya pendaftaran, tidak ada target minimum.
        </p>
        <Button asChild size="lg">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {steps.map((step) => (
          <div key={step.title} className="bg-card rounded-xl border border-border p-5 space-y-2">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
              <step.icon className="w-4.5 h-4.5 text-foreground" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-semibold text-foreground">{step.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Ketentuan singkat</p>
        </div>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
          <li>Komisi dihitung dari subtotal produk, tidak termasuk ongkir.</li>
          <li>Attribution klik berlaku {cookieWindowDays} hari — klik terakhir yang menang.</li>
          <li>Komisi cair setelah pesanan selesai (delivered) dan lewat masa tunggu retur.</li>
          <li>Minimum penarikan Rp{minPayout.toLocaleString('id-ID')}.</li>
          <li>Tidak boleh pakai link sendiri untuk beli produk sendiri.</li>
        </ul>
      </div>
    </div>
  );
}
