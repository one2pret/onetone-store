// app/(admin)/dashboard/orders/_components/RollbackStatusForm.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rollbackOrderStatus } from '@/app/actions/orders';
import { ROLLBACK_TRANSITIONS } from '@/lib/order-status';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { OrderStatus } from '@/lib/order-status';

const STATUS_LABEL: Record<string, string> = {
  packing: 'Dikemas',
  shipping: 'Dikirim',
  delivered: 'Selesai',
};

interface Props {
  orderId: number;
  currentStatus: string;
  adminId: string;
}

export function RollbackStatusForm({ orderId, currentStatus, adminId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  const targetStatus = ROLLBACK_TRANSITIONS[currentStatus as OrderStatus];
  if (!targetStatus) return null;

  function handleRollback() {
    if (!note.trim()) {
      toast.error('Alasan wajib diisi');
      return;
    }
    startTransition(async () => {
      const result = await rollbackOrderStatus(orderId, targetStatus!, note, adminId);
      if (result.success) {
        toast.success(`Status dikembalikan ke "${STATUS_LABEL[targetStatus!]}"`);
        setOpen(false);
        setNote('');
        router.refresh();
      } else {
        toast.error(result.error || 'Gagal rollback');
      }
    });
  }

  return (
    <div className="pt-4 border-t border-border">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-muted-foreground hover:text-destructive transition underline underline-offset-2"
        >
          Kembalikan status ke "{STATUS_LABEL[targetStatus]}"
        </button>
      ) : (
        <div className="space-y-3 bg-destructive/5 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm font-medium text-foreground">
            Kembalikan ke <span className="text-destructive font-semibold">{STATUS_LABEL[targetStatus]}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Aksi ini dicatat di audit log. Wajib isi alasan.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: Kurir gagal pickup, barang belum diambil"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRollback}
              disabled={pending || !note.trim()}
            >
              {pending ? 'Memproses...' : 'Konfirmasi Rollback'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setOpen(false); setNote(''); }}
              disabled={pending}
            >
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
