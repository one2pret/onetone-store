// app/(admin)/dashboard/banners/page.tsx
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllBanners } from '@/app/actions/banners';
import { BannersTable } from './_components/BannersTable';

export default async function BannersPage() {
  const banners = await getAllBanners();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Banner</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola banner slider di homepage</p>
        </div>
        <Button asChild size="sm" className="bg-primary hover:bg-primary-hover text-white rounded-lg">
          <Link href="/dashboard/banners/create">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Banner
          </Link>
        </Button>
      </div>

      <BannersTable banners={banners} />
    </div>
  );
}
