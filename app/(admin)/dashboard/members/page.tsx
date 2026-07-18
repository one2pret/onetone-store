// app/(admin)/dashboard/members/page.tsx
import { getMembers, getMemberTiers } from '@/app/actions/members';
import { MembersTable } from './_components/MembersTable';

interface Props {
  searchParams: Promise<{ tier?: string }>;
}

export default async function AdminMembersPage({ searchParams }: Props) {
  const { tier } = await searchParams;
  const tierId = tier ? Number(tier) : undefined;
  const [members, tiers] = await Promise.all([getMembers(tierId), getMemberTiers()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Member</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} member terdaftar
          </p>
        </div>
        <a
          href={`/api/members/export${tier ? `?tier=${tier}` : ''}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition"
        >
          Export CSV
        </a>
      </div>

      {/* Filter tier */}
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href="/dashboard/members"
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${!tier ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
        >
          Semua
        </a>
        {tiers.map((t) => (
          <a
            key={t.id}
            href={`/dashboard/members?tier=${t.id}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${tier === String(t.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
          >
            {t.name}
          </a>
        ))}
      </div>

      <MembersTable data={members} />
    </div>
  );
}
