// app/(admin)/dashboard/settings/page.tsx
import { getStoreSettings } from '@/app/actions/store-settings';
import { StoreSettingsForm } from './_components/StoreSettingsForm';
import { Settings } from 'lucide-react';

export default async function SettingsPage() {
  const settings = await getStoreSettings();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-5 h-5 md:w-6 md:h-6 text-slate-600 shrink-0" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Pengaturan Toko</h1>
          <p className="text-xs md:text-sm text-slate-500">Kelola informasi toko, lokasi origin pengiriman, dan pembayaran</p>
        </div>
      </div>

      <StoreSettingsForm settings={settings} />
    </div>
  );
}
