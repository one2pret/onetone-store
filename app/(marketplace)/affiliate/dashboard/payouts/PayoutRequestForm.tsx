'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { requestPayout } from '@/app/actions/affiliate';
import { Button } from '@/components/ui/button';
import { formatRupiah } from '@/lib/utils';

export function PayoutRequestForm({
  saldoTersedia, minPayout, canRequest,
}: {
  saldoTersedia: number;
  minPayout: number;
  canRequest: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await requestPayout(null, new FormData());
      if (!result.success) {
        toast.error(result.error ?? 'Gagal mengajukan withdraw');
        return;
      }
      toast.success('Permintaan withdraw terkirim');
      router.refresh();
    });
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Saldo tersedia: {formatRupiah(saldoTersedia)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Minimum penarikan {formatRupiah(minPayout)}</p>
      </div>
      <Button onClick={handleSubmit} disabled={!canRequest || isPending} size="sm">
        {isPending ? 'Memproses...' : 'Tarik Saldo'}
      </Button>
    </div>
  );
}
