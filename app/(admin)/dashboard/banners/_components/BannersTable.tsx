// app/(admin)/dashboard/banners/_components/BannersTable.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Pencil, Trash2, ExternalLink, ImageOff } from 'lucide-react';
import { deleteBanner } from '@/app/actions/banners';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { Banner } from '@/lib/db/schema';

interface BannersTableProps {
  banners: Banner[];
}

function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === '') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export function BannersTable({ banners }: BannersTableProps) {
  const router = useRouter();

  async function handleDelete(id: number) {
    const result = await deleteBanner(id);
    if (result.success) {
      toast.success('Banner berhasil dihapus');
      router.refresh();
    } else {
      toast.error(result.error || 'Gagal menghapus');
    }
  }

  if (banners.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <p className="text-muted-foreground mb-2">Belum ada banner</p>
        <Link href="/dashboard/banners/create" className="text-primary hover:opacity-80 text-sm font-medium">
          Buat Banner Pertama
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="grid gap-3 p-4">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="flex gap-4 items-center p-3 rounded-lg border border-border hover:border-border/80 hover:bg-muted/30 transition"
          >
            {/* Thumbnail */}
            <div className="relative w-40 h-14 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
              {isValidImageUrl(banner.image) ? (
                <Image
                  src={banner.image}
                  alt={banner.title}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    // Sembunyikan image jika gagal load, tampilkan fallback
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <ImageOff className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground truncate">{banner.title}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  banner.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {banner.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              {banner.subtitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{banner.subtitle}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>Urutan: {banner.sortOrder}</span>
                {banner.link && (
                  <span className="flex items-center gap-1 truncate max-w-[200px]">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {banner.link}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <Link
                href={`/dashboard/banners/${banner.id}/edit`}
                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition"
              >
                <Pencil className="w-4 h-4" />
              </Link>
              <ConfirmDialog
                trigger={
                  <button className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                }
                title="Hapus Banner"
                description={`Yakin ingin menghapus banner "${banner.title}"? Tindakan ini tidak dapat dibatalkan.`}
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
