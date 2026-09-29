// app/(admin)/dashboard/settings/staff/page.tsx
import { getStaffInventoryLocations, getStaffUsers } from '@/app/actions/staff';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { StaffList } from './_components/StaffList';
import { AddStaffForm } from './_components/AddStaffForm';

export default async function StaffPage() {
  const [staff, locations, session] = await Promise.all([getStaffUsers(), getStaffInventoryLocations(), auth()]);
  const currentUserId = Number(session?.user?.id ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Kelola Kasir / Staff</h1>
          <p className="text-sm text-muted-foreground">
            Atur akun admin, kasir, serta staf inventori berikut lokasi kerja yang boleh diakses.
          </p>
        </div>
      </div>

      <StaffList staff={staff} locations={locations} currentUserId={currentUserId} />

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Tambah Kasir / Staff Baru</h2>
        <AddStaffForm locations={locations} />
      </div>
    </div>
  );
}
