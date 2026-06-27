// app/(admin)/dashboard/orders/_components/StatusUpdateForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changeOrderStatus } from '@/app/actions/orders';
import { getNextStatuses } from '@/lib/order-status';
import { getStatusLabel } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface Props {
  orderId: number;
  currentStatus: string;
  adminId: string;
}

export function StatusUpdateForm({ orderId, currentStatus, adminId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Filter out 'cancelled' — admin uses dedicated CancelOrderButton for full cancel flow
  const nextStatuses = getNextStatuses(currentStatus).filter(s => s !== 'cancelled');

  async function handleStatusChange(newStatus: string) {
    setLoading(true);
    const result = await changeOrderStatus(orderId, newStatus, `admin:${adminId}`);
    if (!result.success) {
      toast.error(result.error || 'Gagal update status');
    } else {
      toast.success('Status pesanan diperbarui');
    }
    router.refresh();
    setLoading(false);
  }

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Status <strong>{getStatusLabel(currentStatus)}</strong> adalah status akhir.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Ubah Status</Label>
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => (
          <ConfirmDialog
            key={status}
            trigger={
              <Button variant="outline" size="sm" disabled={loading}>
                {getStatusLabel(status)}
              </Button>
            }
            title="Ubah Status Pesanan"
            description={`Ubah status pesanan dari "${getStatusLabel(currentStatus)}" ke "${getStatusLabel(status)}"?`}
            confirmLabel="Ya, Ubah"
            onConfirm={() => handleStatusChange(status)}
          />
        ))}
      </div>
    </div>
  );
}
