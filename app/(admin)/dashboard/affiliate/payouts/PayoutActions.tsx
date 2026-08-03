'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { approvePayoutRequest, markPayoutCompleted, rejectPayoutRequest } from '@/app/actions/affiliate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function PayoutActions({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  function run(action: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error ?? 'Gagal memproses');
        return;
      }
      toast.success(successMsg);
      setRejecting(false);
      router.refresh();
    });
  }

  if (rejecting) {
    return (
      <div className="flex items-center gap-2">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan..." className="h-8 text-xs w-40" />
        <Button size="sm" variant="destructive" disabled={isPending || !reason.trim()} onClick={() => {
          const formData = new FormData();
          formData.set('id', String(id));
          formData.set('reason', reason);
          run(() => rejectPayoutRequest(null, formData), 'Payout ditolak');
        }}>
          Konfirmasi
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Batal</Button>
      </div>
    );
  }

  if (status === 'requested') {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={isPending} onClick={() => run(() => approvePayoutRequest(id), 'Payout disetujui')}>
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setRejecting(true)}>Reject</Button>
      </div>
    );
  }

  if (status === 'approved' || status === 'processing') {
    return (
      <Button size="sm" disabled={isPending} onClick={() => run(() => markPayoutCompleted(id), 'Ditandai selesai')}>
        Tandai Selesai (Transfer Manual)
      </Button>
    );
  }

  return null;
}
