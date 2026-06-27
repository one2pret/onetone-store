// components/shop/OrderStepper.tsx
'use client';

import { Check, CreditCard, Package, Truck, PackageCheck, XCircle, Clock } from 'lucide-react';

const MAIN_STEPS = [
  { key: 'waiting_payment', label: 'Pembayaran', icon: CreditCard },
  { key: 'packing', label: 'Dikemas', icon: Package },
  { key: 'shipping', label: 'Dikirim', icon: Truck },
  { key: 'delivered', label: 'Selesai', icon: PackageCheck },
] as const;

type StepKey = (typeof MAIN_STEPS)[number]['key'];

function getStepIndex(status: string): number {
  const idx = MAIN_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : -1;
}

interface Props {
  status: string;
  compact?: boolean;
  /** Pre-formatted timestamp strings (formatted on server) */
  timestamps?: {
    createdAt?: string | null;
    paidAt?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
  };
}

export function OrderStepper({ status, compact = false, timestamps }: Props) {
  const isCancelled = status === 'cancelled';
  const isExpired = status === 'expired';
  const currentIdx = getStepIndex(status);

  // For cancelled/expired, show how far it got
  const activeIdx = isCancelled || isExpired ? -1 : currentIdx;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {MAIN_STEPS.map((step, i) => {
          const done = activeIdx >= 0 && i <= activeIdx;
          const isCurrent = i === activeIdx;

          return (
            <div key={step.key} className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  done
                    ? isCurrent
                      ? 'bg-primary ring-2 ring-primary/30'
                      : 'bg-primary'
                    : 'bg-slate-200'
                }`}
                title={step.label}
              />
              {i < MAIN_STEPS.length - 1 && (
                <div className={`w-4 h-0.5 ${done && i < activeIdx ? 'bg-primary' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
        {(isCancelled || isExpired) && (
          <div className="ml-1">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          </div>
        )}
      </div>
    );
  }

  // Full stepper for detail page
  function getTimestamp(stepKey: StepKey): string | null {
    if (!timestamps) return null;
    if (stepKey === 'waiting_payment') return timestamps.createdAt || null;
    if (stepKey === 'packing') return timestamps.paidAt || null;
    if (stepKey === 'shipping') return timestamps.shippedAt || null;
    if (stepKey === 'delivered') return timestamps.deliveredAt || null;
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between relative">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 mx-10" />
        {activeIdx > 0 && (
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary mx-10 transition-all"
            style={{ width: `${(activeIdx / (MAIN_STEPS.length - 1)) * 100}%`, maxWidth: 'calc(100% - 80px)' }}
          />
        )}

        {MAIN_STEPS.map((step, i) => {
          const done = activeIdx >= 0 && i <= activeIdx;
          const isCurrent = i === activeIdx;
          const Icon = step.icon;
          const timestamp = getTimestamp(step.key);

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  done
                    ? isCurrent
                      ? 'bg-primary border-primary text-white shadow-md shadow-primary/30'
                      : 'bg-primary border-primary text-white'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {done && !isCurrent ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <p className={`text-xs mt-2 font-medium text-center ${
                done ? 'text-primary' : 'text-slate-400'
              }`}>
                {step.label}
              </p>
              {timestamp && (
                <p className="text-[10px] text-slate-400 mt-0.5 text-center">{timestamp}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Cancelled/Expired banner */}
      {isCancelled && (
        <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <XCircle className="w-4 h-4" />
          Pesanan dibatalkan
        </div>
      )}
      {isExpired && (
        <div className="mt-4 flex items-center gap-2 text-sm text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
          <Clock className="w-4 h-4" />
          Pembayaran kadaluarsa
        </div>
      )}
    </div>
  );
}
