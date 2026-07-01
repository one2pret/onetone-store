// app/(admin)/dashboard/banners/create/page.tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BannerForm } from '../_components/BannerForm';

export default function CreateBannerPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/banners"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Tambah Banner</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Buat banner baru untuk slider homepage</p>
      </div>

      <div className="max-w-2xl bg-card border border-border rounded-xl shadow-sm p-5 md:p-6">
        <BannerForm />
      </div>
    </div>
  );
}
