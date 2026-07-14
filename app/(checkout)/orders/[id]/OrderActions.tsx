// app/(shop)/orders/[id]/OrderActions.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelOrderByCustomer, repayOrder } from '@/app/actions/orders';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CreditCard, XCircle, RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  orderId: number;
  status: string;
  invoiceUrl: string | null;
}

export function OrderActions({ orderId, status, invoiceUrl }: Props) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handlePayNow() {
    if (invoiceUrl) {
      window.location.href = invoiceUrl;
    }
  }

  // Create new invoice (for orders without invoice, or expired orders)
  function handleCreatePayment() {
    startTransition(async () => {
      setError('');
      const result = await repayOrder(orderId);
      if (!result.success) {
        setError(result.error || 'Gagal membuat pembayaran');
      } else if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        router.refresh();
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      setError('');
      const result = await cancelOrderByCustomer(orderId);
      if (!result.success) {
        setError(result.error || 'Gagal membatalkan pesanan');
      } else {
        router.refresh();
      }
    });
  }

  const showActions = status === 'waiting_payment' || status === 'expired';
  if (!showActions) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      {error && (
        <p className="text-sm text-red-500 mb-3">{error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        {/* waiting_payment WITH invoice → go to existing payment page */}
        {status === 'waiting_payment' && invoiceUrl && (
          <Button onClick={handlePayNow} disabled={isPending}>
            <CreditCard className="w-4 h-4 mr-2" />
            Bayar Sekarang
          </Button>
        )}

        {/* waiting_payment WITHOUT invoice → create new invoice */}
        {status === 'waiting_payment' && !invoiceUrl && (
          <Button onClick={handleCreatePayment} disabled={isPending}>
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4 mr-2" />
            )}
            Bayar Sekarang
          </Button>
        )}

        {status === 'waiting_payment' && (
          <ConfirmDialog
            trigger={
              <Button variant="destructive" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Batalkan Pesanan
              </Button>
            }
            title="Batalkan Pesanan"
            description="Yakin ingin membatalkan pesanan ini? Tindakan ini tidak dapat dibatalkan."
            confirmLabel="Ya, Batalkan"
            variant="destructive"
            onConfirm={handleCancel}
          />
        )}

        {status === 'expired' && (
          <Button onClick={handleCreatePayment} disabled={isPending}>
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Bayar Ulang
          </Button>
        )}
      </div>
    </div>
  );
}
