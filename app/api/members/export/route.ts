// app/api/members/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getMembers } from '@/app/actions/members';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tier = req.nextUrl.searchParams.get('tier');
  const members = await getMembers(tier ? Number(tier) : undefined);

  const header = ['ID', 'Nama', 'Email', 'No HP', 'Tier', 'Poin', 'Total Belanja (Rp)', 'Tanggal Lahir', 'Bergabung'];
  const rows = members.map((m) => [
    m.id,
    m.name,
    m.email,
    m.phone ?? '',
    m.tierName ?? '',
    m.points ?? 0,
    m.totalSpend ?? 0,
    m.birthdate ?? '',
    m.createdAt ? new Date(m.createdAt).toLocaleDateString('id-ID') : '',
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="members-${Date.now()}.csv"`,
    },
  });
}
