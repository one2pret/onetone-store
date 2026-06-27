'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelOrderByAdmin } from '@/app/actions/orders';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { XCircle } from 'lucide-react';

interface Props {
  orderId: number;
}

export function CancelOrderButton({ orderId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    setLoading(true);
    const result = await cancelOrderByAdmin(orderId);
    if (result.success) {
      toast.success('Pesanan berhasil dibatalkan');
    } else {
      toast.error(result.error || 'Gagal membatalkan pesanan');
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm" disabled={loading} className="w-full">
          <XCircle className="w-4 h-4 mr-2" />
          {loading ? 'Membatalkan...' : 'Batalkan Pesanan'}
        </Button>
      }
      title="Batalkan Pesanan"
      description="Yakin ingin membatalkan pesanan ini? Stok produk akan dikembalikan. Tindakan ini tidak dapat dibatalkan."
      confirmLabel="Ya, Batalkan"
      variant="destructive"
      onConfirm={handleCancel}
    />
  );
}
