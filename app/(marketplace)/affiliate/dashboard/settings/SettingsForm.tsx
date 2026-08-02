'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateBankAccount } from '@/app/actions/affiliate';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Affiliate } from '@/lib/db/schema';

const BANKS = ['BCA', 'BNI', 'BRI', 'MANDIRI', 'CIMB', 'PERMATA'];

export function SettingsForm({ affiliate }: { affiliate: Affiliate }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateBankAccount(null, formData);
      if (!result.success) {
        setError(result.error ?? 'Gagal menyimpan');
        toast.error(result.error ?? 'Gagal menyimpan');
        return;
      }
      toast.success('Data rekening tersimpan');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-5 space-y-4 max-w-md">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="bankCode">Bank</Label>
        <select
          id="bankCode"
          name="bankCode"
          required
          defaultValue={affiliate.bankCode ?? ''}
          className="w-full h-9 px-3 rounded-md border border-border bg-input text-sm text-foreground"
        >
          <option value="">— Pilih bank —</option>
          {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bankAccountNumber">Nomor Rekening</Label>
        <Input id="bankAccountNumber" name="bankAccountNumber" required defaultValue={affiliate.bankAccountNumber ?? ''} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bankAccountName">Nama Pemilik Rekening</Label>
        <Input id="bankAccountName" name="bankAccountName" required defaultValue={affiliate.bankAccountName ?? ''} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="npwp">NPWP (opsional)</Label>
        <Input id="npwp" name="npwp" defaultValue={affiliate.npwp ?? ''} placeholder="Belum wajib di tahap ini" />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
