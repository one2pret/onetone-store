// app/(admin)/dashboard/members/page.tsx
import { getMembers, getMemberTiers, getPosCustomerLeads } from '@/app/actions/members';
import { MembersTable } from './_components/MembersTable';
import { PosCustomerLeadsTable } from './_components/PosCustomerLeadsTable';
import Link from 'next/link';

interface Props {
  searchParams: Promise<{ tier?: string }>;
}

export default async function AdminMembersPage({ searchParams }: Props) {
  const { tier } = await searchParams;
  const tierId = tier ? Number(tier) : undefined;
  const [members, tiers, posLeads] = await Promise.all([
    getMembers(tierId),
    getMemberTiers(),
    getPosCustomerLeads(),
  ]);
  const pendingLeadCount = posLeads.filter(lead => lead.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Member</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} member terdaftar · {pendingLeadCount} calon member POS
          </p>
        </div>
        <a
          href={`/api/members/export${tier ? `?tier=${tier}` : ''}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition"
        >
          Export CSV
        </a>
      </div>

      <PosCustomerLeadsTable data={posLeads} />

      {/* Filter tier */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/dashboard/members"
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${!tier ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
        >
          Semua
        </Link>
        {tiers.map((t) => (
          <Link
            key={t.id}
            href={`/dashboard/members?tier=${t.id}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${tier === String(t.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
          >
            {t.name}
          </Link>
        ))}
      </div>

      <MembersTable data={members} />
    </div>
  );
}
