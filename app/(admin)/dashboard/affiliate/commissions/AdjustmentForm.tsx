'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { adjustCommission } from '@/app/actions/affiliate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AdjustmentForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await adjustCommission(null, formData);
      if (!result.success) {
        toast.error(result.error ?? 'Gagal simpan adjustment');
        return;
      }
      toast.success('Adjustment tersimpan');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>+ Adjustment Manual</Button>;
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-5 space-y-4 max-w-md">
      <p className="text-sm font-semibold text-foreground">Adjustment Komisi Manual</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="affiliateId">Affiliate ID</Label>
          <Input id="affiliateId" name="affiliateId" type="number" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="orderId">Order ID</Label>
          <Input id="orderId" name="orderId" type="number" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">Nominal (negatif untuk pengurangan)</Label>
        <Input id="amount" name="amount" type="number" required placeholder="50000 atau -50000" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reason">Alasan</Label>
        <Input id="reason" name="reason" required placeholder="Koreksi manual: ..." />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
      </div>
    </form>
  );
}
