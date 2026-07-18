// app/(admin)/dashboard/settings/tiers/_components/TierCard.tsx
'use client';

import { useActionState } from 'react';
import { updateTier } from '@/app/actions/tiers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { InferSelectModel } from 'drizzle-orm';
import type { memberTiers } from '@/lib/db/schema';

type Tier = InferSelectModel<typeof memberTiers>;

const tierColor: Record<string, string> = {
  Silver:   'border-zinc-400/40',
  Gold:     'border-amber-400/40',
  Platinum: 'border-sky-400/40',
};

export function TierCard({ tier }: { tier: Tier }) {
  const action = updateTier.bind(null, tier.id);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className={`bg-card border rounded-xl p-5 space-y-4 ${tierColor[tier.name] ?? 'border-border'}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">{tier.name}</h2>
        {state?.success && (
          <span className="text-xs text-green-500 font-medium">Tersimpan</span>
        )}
        {state?.error && (
          <span className="text-xs text-destructive">{state.error}</span>
        )}
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="name" value={tier.name} />

        <div>
          <Label className="text-xs text-muted-foreground">Min. Belanja (Rp)</Label>
          <Input name="min_spend" type="number" min={0} defaultValue={tier.minSpend ?? 0} className="mt-1 h-9 text-sm" />
          <p className="text-[11px] text-muted-foreground mt-0.5">Total belanja agar masuk tier ini</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Diskon (%)</Label>
          <Input name="discount_pct" type="number" min={0} max={100} defaultValue={tier.discountPct ?? 0} className="mt-1 h-9 text-sm" />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Multiplier Poin</Label>
          <Input name="point_multiplier" type="number" min={1} defaultValue={tier.pointMultiplier ?? 1} className="mt-1 h-9 text-sm" />
          <p className="text-[11px] text-muted-foreground mt-0.5">Poin = subtotal ÷ 1.000 × multiplier</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Gratis Ongkir min. Order (Rp)</Label>
          <Input
            name="free_shipping_threshold"
            type="number"
            min={0}
            defaultValue={tier.freeShippingThreshold ?? ''}
            placeholder="Kosongkan = tidak ada"
            className="mt-1 h-9 text-sm"
          />
        </div>

        <Button type="submit" size="sm" disabled={pending} className="w-full mt-1">
          {pending ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </form>
    </div>
  );
}
