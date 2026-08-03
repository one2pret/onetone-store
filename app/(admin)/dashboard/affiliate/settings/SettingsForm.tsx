'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateAffiliateSettings } from '@/app/actions/affiliate';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { AffiliateSettings } from '@/lib/db/schema';

export function SettingsForm({ settings }: { settings: AffiliateSettings | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateAffiliateSettings(null, formData);
      if (!result.success) {
        toast.error('Gagal menyimpan');
        return;
      }
      toast.success('Pengaturan tersimpan');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-5 space-y-5 max-w-lg">
      <div className="flex items-center gap-2">
        <input type="checkbox" id="isEnabled" name="isEnabled" defaultChecked={settings?.isEnabled ?? false} className="w-4 h-4" />
        <Label htmlFor="isEnabled" className="cursor-pointer">Program affiliate aktif (halaman publik terbuka)</Label>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="autoApproveRegistration" name="autoApproveRegistration" defaultChecked={settings?.autoApproveRegistration ?? false} className="w-4 h-4" />
        <Label htmlFor="autoApproveRegistration" className="cursor-pointer">Auto-approve pendaftaran (skip review manual)</Label>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="allowSelfReferral" name="allowSelfReferral" defaultChecked={settings?.allowSelfReferral ?? false} className="w-4 h-4" />
        <Label htmlFor="allowSelfReferral" className="cursor-pointer">Izinkan self-referral (affiliate pakai link sendiri)</Label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cookieWindowDays">Cookie Window (hari)</Label>
          <Input id="cookieWindowDays" name="cookieWindowDays" type="number" defaultValue={settings?.cookieWindowDays ?? 30} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="holdPeriodDays">Hold Period (hari)</Label>
          <Input id="holdPeriodDays" name="holdPeriodDays" type="number" defaultValue={settings?.holdPeriodDays ?? 7} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="defaultRatePercent">Default Rate (%)</Label>
          <Input id="defaultRatePercent" name="defaultRatePercent" type="number" step="0.01" defaultValue={settings?.defaultRatePercent ?? 5} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minPayoutAmount">Min Payout</Label>
          <Input id="minPayoutAmount" name="minPayoutAmount" type="number" defaultValue={settings?.minPayoutAmount ?? 50000} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payoutAdminFee">Admin Fee</Label>
          <Input id="payoutAdminFee" name="payoutAdminFee" type="number" defaultValue={settings?.payoutAdminFee ?? 0} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="termsContent">Terms & Conditions</Label>
        <Textarea id="termsContent" name="termsContent" rows={5} defaultValue={settings?.termsContent ?? ''} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
      </Button>
    </form>
  );
}
