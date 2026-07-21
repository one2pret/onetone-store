// app/(admin)/dashboard/settings/page.tsx
import { getStoreSettings, getHeroConfig } from '@/app/actions/store-settings';
import { getPosSettings } from '@/app/actions/pos-settings';
import { getFeaturedProducts, getActiveProducts } from '@/app/actions/products';
import { getEditorialBreaks } from '@/app/actions/editorial-settings';
import { StoreSettingsForm } from './_components/StoreSettingsForm';
import { PosSettingsCard } from './_components/PosSettingsCard';
import { DataToolsCard } from './_components/DataToolsCard';
import { HeroSettingsCard } from './_components/HeroSettingsCard';
import { EditorialSettingsCard } from './_components/EditorialSettingsCard';
import { Settings, Crown, Users } from 'lucide-react';
import Link from 'next/link';

export default async function SettingsPage() {
  const [settings, posSettings, heroConfig, featuredProducts, activeProducts, editorialBreaks] =
    await Promise.all([
      getStoreSettings(),
      getPosSettings(),
      getHeroConfig(),
      getFeaturedProducts(24),
      getActiveProducts({ limit: 100 }),
      getEditorialBreaks(),
    ]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground shrink-0" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Pengaturan Toko</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Kelola informasi toko, lokasi origin pengiriman, pembayaran, kasir POS, dan tampilan landing</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Quick links */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/settings/tiers"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition text-sm font-medium text-foreground"
          >
            <Crown className="w-4 h-4 text-muted-foreground" />
            Pengaturan Tier Member
          </Link>
          <Link
            href="/dashboard/settings/staff"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition text-sm font-medium text-foreground"
          >
            <Users className="w-4 h-4 text-muted-foreground" />
            Kelola Kasir / Staff
          </Link>
        </div>

        <StoreSettingsForm settings={settings} />
        <HeroSettingsCard config={heroConfig} featuredProducts={featuredProducts} />
        <EditorialSettingsCard breaks={editorialBreaks} products={activeProducts} />
        <PosSettingsCard qrisUrl={posSettings.qrisUrl} receiptFooter={posSettings.receiptFooter} />
        <DataToolsCard />
      </div>
    </div>
  );
}
