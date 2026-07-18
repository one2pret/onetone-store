// app/(admin)/dashboard/members/_components/TierOverride.tsx
'use client';

import { useState, useTransition } from 'react';
import { overrideMemberTier } from '@/app/actions/tiers';
import { Button } from '@/components/ui/button';

type Tier = { id: number; name: string };

interface Props {
  userId: number;
  currentTierId: number | null;
  tiers: Tier[];
}

export function TierOverride({ userId, currentTierId, tiers }: Props) {
  const [selected, setSelected] = useState(currentTierId ?? tiers[0]?.id ?? 0);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await overrideMemberTier(userId, selected);
      setStatus(res.success ? 'ok' : 'err');
      setTimeout(() => setStatus('idle'), 3000);
    });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={selected}
        onChange={(e) => setSelected(Number(e.target.value))}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      >
        {tiers.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <Button size="sm" onClick={handleSave} disabled={pending}>
        {pending ? 'Menyimpan...' : 'Ubah Tier'}
      </Button>
      {status === 'ok' && <span className="text-xs text-green-500">Tier diubah</span>}
      {status === 'err' && <span className="text-xs text-destructive">Gagal</span>}
    </div>
  );
}
