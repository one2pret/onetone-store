'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { approveAffiliate, rejectAffiliate, reactivateAffiliate } from '@/app/actions/affiliate';
import { formatDate } from '@/lib/utils';
import type { Affiliate, User } from '@/lib/db/schema';

type AffiliateWithUser = Affiliate & { user: User | null };

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-secondary text-secondary-foreground',
  active: 'bg-success/20 text-success',
  suspended: 'bg-destructive/20 text-destructive',
  rejected: 'bg-destructive/20 text-destructive',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu', active: 'Aktif', suspended: 'Dibekukan', rejected: 'Ditolak',
};

export function MembersTable({ data }: { data: AffiliateWithUser[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleApprove(id: number) {
    startTransition(async () => {
      const result = await approveAffiliate(id);
      if (!result.success) { toast.error('Gagal approve'); return; }
      toast.success('Affiliate disetujui');
      router.refresh();
    });
  }

  function handleReject(id: number) {
    startTransition(async () => {
      const result = await rejectAffiliate(id);
      if (!result.success) { toast.error('Gagal reject'); return; }
      toast.success('Pendaftaran ditolak');
      router.refresh();
    });
  }

  function handleReactivate(id: number) {
    startTransition(async () => {
      const result = await reactivateAffiliate(id);
      if (!result.success) { toast.error('Gagal reaktivasi'); return; }
      toast.success('Affiliate diaktifkan kembali');
      router.refresh();
    });
  }

  const columns: ColumnDef<AffiliateWithUser>[] = [
    {
      id: 'name',
      header: 'Nama',
      cell: ({ row }) => (
        <Link href={`/dashboard/affiliate/members/${row.original.id}`} className="text-sm font-medium text-foreground hover:text-primary">
          {row.original.displayName || row.original.user?.name || '-'}
        </Link>
      ),
    },
    {
      id: 'code',
      header: 'Kode',
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>,
    },
    {
      id: 'tier',
      header: 'Tier',
      cell: ({ row }) => <span className="text-sm text-muted-foreground capitalize">{row.original.tier}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={STATUS_STYLE[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>
      ),
    },
    {
      id: 'createdAt',
      header: 'Daftar',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt!)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const affiliate = row.original;
        if (affiliate.status === 'pending') {
          return (
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={isPending} onClick={() => handleApprove(affiliate.id)}>Approve</Button>
              <ConfirmDialog
                trigger={<Button size="sm" variant="outline" disabled={isPending}>Reject</Button>}
                title="Tolak pendaftaran?"
                description={`Pendaftaran ${affiliate.displayName} akan ditolak.`}
                variant="destructive"
                onConfirm={() => handleReject(affiliate.id)}
              />
            </div>
          );
        }
        if (affiliate.status === 'suspended') {
          return <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleReactivate(affiliate.id)}>Aktifkan Lagi</Button>;
        }
        return (
          <Link href={`/dashboard/affiliate/members/${affiliate.id}`} className="text-xs text-muted-foreground hover:text-foreground">
            Detail →
          </Link>
        );
      },
    },
  ];

  return <DataTable columns={columns} data={data} emptyMessage="Belum ada affiliate" />;
}
