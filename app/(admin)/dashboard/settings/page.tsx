// app/(admin)/dashboard/settings/page.tsx
import { getStoreSettings } from '@/app/actions/store-settings';
import { getPosSettings } from '@/app/actions/pos-settings';
import { StoreSettingsForm } from './_components/StoreSettingsForm';
import { PosSettingsCard } from './_components/PosSettingsCard';
import { DataToolsCard } from './_components/DataToolsCard';
import { Settings } from 'lucide-react';

export default async function SettingsPage() {
  const [settings, posSettings] = await Promise.all([
    getStoreSettings(),
    getPosSettings(),
  ]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground shrink-0" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Pengaturan Toko</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Kelola informasi toko, lokasi origin pengiriman, pembayaran, dan kasir POS</p>
        </div>
      </div>

      <div className="space-y-8">
        <StoreSettingsForm settings={settings} />
        <PosSettingsCard qrisUrl={posSettings.qrisUrl} receiptFooter={posSettings.receiptFooter} />
        <DataToolsCard />
      </div>
    </div>
  );
}
