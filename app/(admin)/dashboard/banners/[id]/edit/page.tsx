// app/(admin)/dashboard/banners/[id]/edit/page.tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getBanner } from '@/app/actions/banners';
import { BannerForm } from '../../_components/BannerForm';

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const banner = await getBanner(Number(id));

  if (!banner) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/banners"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Edit Banner</h1>
        <p className="text-sm text-slate-500 mt-0.5">{banner.title}</p>
      </div>

      <div className="max-w-2xl bg-white rounded-xl border border-slate-200/60 shadow-sm p-5 md:p-6">
        <BannerForm banner={banner} />
      </div>
    </div>
  );
}
