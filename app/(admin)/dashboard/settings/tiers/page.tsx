// app/(admin)/dashboard/settings/tiers/page.tsx
import { getAllTiers } from '@/app/actions/tiers';
import { TierCard } from './_components/TierCard';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default async function TiersSettingsPage() {
  const tiers = await getAllTiers();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Pengaturan Tier Member</h1>
          <p className="text-sm text-muted-foreground">
            Atur threshold, diskon, dan multiplier poin tiap tier. Naik tier otomatis berdasarkan total belanja.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground space-y-1">
        <p><span className="font-medium text-foreground">Cara kerja:</span> User otomatis naik tier saat total belanja mencapai <span className="font-medium text-foreground">Min. Belanja</span> tier berikutnya.</p>
        <p>Poin = subtotal order ÷ 1.000 × Multiplier. Misal: order Rp500.000 × multiplier 2 = 1.000 poin.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiers.map((tier) => (
          <TierCard key={tier.id} tier={tier} />
        ))}
      </div>
    </div>
  );
}
