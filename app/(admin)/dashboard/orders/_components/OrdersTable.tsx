'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import { useQueryState } from 'nuqs';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRupiah, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Order, OrderItem, User } from '@/lib/db/schema';

type OrderWithUser = Order & {
  items: OrderItem[];
  user: User | null;
};

const statusFilters = [
  { value: '', label: 'Semua' },
  { value: 'waiting_payment', label: 'Menunggu Pembayaran' },
  { value: 'packing', label: 'Dikemas' },
  { value: 'shipping', label: 'Dikirim' },
  { value: 'delivered', label: 'Selesai' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={getStatusColor(status)}>
      {getStatusLabel(status)}
    </Badge>
  );
}

const columns: ColumnDef<OrderWithUser>[] = [
  {
    accessorKey: 'orderNumber',
    header: 'No. Order',
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">{row.getValue('orderNumber')}</span>
    ),
  },
  {
    id: 'customer',
    header: 'Customer',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.user?.name || '-'}</span>
    ),
  },
  {
    accessorKey: 'total',
    header: 'Total',
    cell: ({ row }) => (
      <span className="font-medium">{formatRupiah(row.getValue('total') as string)}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <StatusBadge status={row.getValue('status') as string || 'waiting_payment'} />
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Tanggal',
    cell: ({ row }) => {
      const date = row.getValue('createdAt');
      return (
        <span className="text-sm text-slate-500">
          {date ? formatDate(date as Date) : '-'}
        </span>
      );
    },
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Aksi</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/orders/${row.original.id}`}>
            <Eye className="w-4 h-4 text-primary" />
          </Link>
        </Button>
      </div>
    ),
  },
];

interface Props {
  data: OrderWithUser[];
}

export function OrdersTable({ data }: Props) {
  const [status, setStatus] = useQueryState('status', { defaultValue: '' });

  const filteredData = useMemo(() => {
    if (!status) return data;
    return data.filter((order) => order.status === status);
  }, [data, status]);

  return (
    <div>
      {/* Status Filter */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 md:px-5 py-3 md:py-4 border-b border-slate-200/60 scrollbar-none">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatus(filter.value || null)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              status === filter.value
                ? 'bg-primary text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={filteredData} emptyMessage="Belum ada pesanan" />
    </div>
  );
}
