// app/(admin)/dashboard/orders/[id]/SendOrderButton.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendOrderToBitship } from '@/app/actions/shipping';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Truck, Loader2 } from 'lucide-react';

interface Props {
  orderId: number;
}

export function SendOrderButton({ orderId }: Props) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    startTransition(async () => {
      const result = await sendOrderToBitship(orderId);
      if (!result.success) {
        setError(result.error || 'Gagal mengirim pesanan');
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-500 mb-3">{error}</p>
      )}
      <ConfirmDialog
        trigger={
          <Button disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <Truck className="w-4 h-4 mr-2" />
                Kirim Order ke Kurir
              </>
            )}
          </Button>
        }
        title="Kirim Pesanan"
        description="Kirim pesanan ini ke kurir via Bitship? Pastikan pesanan sudah dikemas dengan baik."
        confirmLabel="Ya, Kirim"
        onConfirm={handleSend}
      />
    </div>
  );
}
