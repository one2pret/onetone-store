// app/(marketplace)/affiliate/dashboard/settings/page.tsx
import { getMyAffiliate } from '@/app/actions/affiliate';
import { SettingsForm } from './SettingsForm';

export default async function AffiliateSettingsPage() {
  const affiliate = await getMyAffiliate();
  if (!affiliate) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Data rekening untuk penarikan saldo</p>
      </div>

      <SettingsForm affiliate={affiliate} />
    </div>
  );
}
