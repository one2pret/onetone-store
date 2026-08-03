'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { toggleCommissionRule, deleteCommissionRule } from '@/app/actions/affiliate';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import type { CommissionRule } from '@/lib/db/schema';

export function RulesList({ rules }: { rules: CommissionRule[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: number, isActive: boolean) {
    startTransition(async () => {
      await toggleCommissionRule(id, !isActive);
      toast.success(isActive ? 'Rule dinonaktifkan' : 'Rule diaktifkan');
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      await deleteCommissionRule(id);
      toast.success('Rule dihapus');
      router.refresh();
    });
  }

  if (rules.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Belum ada rule komisi. Sistem pakai default rate dari Pengaturan.</p>;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Scope</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Rate</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Cap</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Priority</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rules.map((r) => (
            <tr key={r.id} className={cn(!r.isActive && 'opacity-50')}>
              <td className="px-4 py-3 text-foreground capitalize">
                {r.scope}{r.scopeTier ? ` (${r.scopeTier})` : ''}{r.categoryId ? ` #${r.categoryId}` : ''}{r.productId ? ` #${r.productId}` : ''}
              </td>
              <td className="px-4 py-3 text-right text-foreground">{Number(r.ratePercent)}%</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{r.maxCommission ? Number(r.maxCommission).toLocaleString('id-ID') : '-'}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{r.priority}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.isActive ? 'Aktif' : 'Nonaktif'}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleToggle(r.id, r.isActive)}>
                    {r.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  <ConfirmDialog
                    trigger={<Button size="sm" variant="ghost" disabled={isPending}>Hapus</Button>}
                    title="Hapus rule?"
                    description="Rule ini akan dihapus permanen."
                    variant="destructive"
                    onConfirm={() => handleDelete(r.id)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
