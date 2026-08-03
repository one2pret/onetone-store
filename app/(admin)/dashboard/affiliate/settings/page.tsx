// app/(admin)/dashboard/affiliate/settings/page.tsx
import { getAffiliateSettings } from '@/app/actions/affiliate';
import { SettingsForm } from './SettingsForm';

export default async function AdminAffiliateSettingsPage() {
  const settings = await getAffiliateSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Pengaturan Affiliate</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Konfigurasi program affiliate secara global</p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
