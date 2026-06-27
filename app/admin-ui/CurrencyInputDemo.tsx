// app/admin-ui/CurrencyInputDemo.tsx
'use client';

import { CurrencyInput } from '@/components/ui/currency-input';

export function AdminCurrencyInputDemo() {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">Harga (Rp)</label>
      <CurrencyInput
        id="price-admin-demo"
        name="price"
        defaultValue={19500000}
        placeholder="Ketik harga..."
      />
      <p className="text-xs text-slate-400 mt-1">Otomatis format ribuan saat diketik</p>
    </div>
  );
}
