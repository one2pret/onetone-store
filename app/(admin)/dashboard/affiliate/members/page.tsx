// app/(admin)/dashboard/affiliate/members/page.tsx
import Link from 'next/link';
import { getAllAffiliates } from '@/app/actions/affiliate';
import { cn } from '@/lib/utils';
import { MembersTable } from './MembersTable';

const FILTERS = [
  { value: undefined, label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'active', label: 'Aktif' },
  { value: 'suspended', label: 'Dibekukan' },
  { value: 'rejected', label: 'Ditolak' },
];

export default async function AdminAffiliateMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const affiliates = await getAllAffiliates(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Kelola Affiliate</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{affiliates.length} affiliate</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/dashboard/affiliate/members?status=${f.value}` : '/dashboard/affiliate/members'}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition',
              status === f.value || (!status && !f.value)
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <MembersTable data={affiliates} />
    </div>
  );
}
