// app/(admin)/dashboard/banners/_components/BannersTable.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { deleteBanner } from '@/app/actions/banners';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import type { Banner } from '@/lib/db/schema';

interface BannersTableProps {
  banners: Banner[];
}

export function BannersTable({ banners }: BannersTableProps) {
  async function handleDelete(id: number) {
    const result = await deleteBanner(id);
    if (result.success) {
      toast.success('Banner berhasil dihapus');
    } else {
      toast.error(result.error || 'Gagal menghapus');
    }
  }

  if (banners.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
        <p className="text-slate-400 mb-2">Belum ada banner</p>
        <Link href="/dashboard/banners/create" className="text-primary hover:text-primary-hover text-sm font-medium">
          Buat Banner Pertama
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="grid gap-4 p-4">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="flex gap-4 items-center p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition"
          >
            {/* Thumbnail */}
            <div className="relative w-40 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
              <Image
                src={banner.image}
                alt={banner.title}
                fill
                className="object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-800 truncate">{banner.title}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  banner.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {banner.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              {banner.subtitle && (
                <p className="text-xs text-slate-500 truncate mt-0.5">{banner.subtitle}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span>Urutan: {banner.sortOrder}</span>
                {banner.link && (
                  <span className="flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    {banner.link}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <Link
                href={`/dashboard/banners/${banner.id}/edit`}
                className="p-2 text-primary hover:bg-primary/5 rounded-lg transition"
              >
                <Pencil className="w-4 h-4" />
              </Link>
              <ConfirmDialog
                trigger={
                  <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                }
                title="Hapus Banner"
                description={`Yakin ingin menghapus banner "${banner.title}"?`}
                confirmLabel="Ya, Hapus"
                variant="destructive"
                onConfirm={() => handleDelete(banner.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
