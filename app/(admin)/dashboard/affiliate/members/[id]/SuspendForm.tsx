'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { suspendAffiliate } from '@/app/actions/affiliate';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function SuspendForm({ affiliateId }: { affiliateId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  function handleSubmit() {
    const formData = new FormData();
    formData.set('id', String(affiliateId));
    formData.set('reason', reason);

    startTransition(async () => {
      const result = await suspendAffiliate(null, formData);
      if (!result.success) {
        toast.error(result.error ?? 'Gagal membekukan');
        return;
      }
      toast.success('Affiliate dibekukan');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Bekukan Akun</Button>;
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3 max-w-md">
      <p className="text-sm font-medium text-foreground">Alasan pembekuan</p>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Wajib diisi" />
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" disabled={isPending || !reason.trim()} onClick={handleSubmit}>
          Bekukan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
      </div>
    </div>
  );
}
