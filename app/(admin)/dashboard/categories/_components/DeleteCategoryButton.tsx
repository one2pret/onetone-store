// app/(admin)/categories/_components/DeleteCategoryButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCategory } from '@/app/actions/categories';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface Props {
  id: number;
  name: string;
}

export function DeleteCategoryButton({ id, name }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const result = await deleteCategory(id);

    if (result.success) {
      toast.success('Kategori berhasil dihapus');
      router.refresh();
    } else {
      toast.error(result.error || 'Gagal hapus kategori');
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon" disabled={loading}>
          <Trash2 className="w-4 h-4 text-red-600" />
        </Button>
      }
      title="Hapus Kategori"
      description={`Yakin ingin menghapus kategori "${name}"? Tindakan ini tidak dapat dibatalkan.`}
      confirmLabel="Ya, Hapus"
      variant="destructive"
      onConfirm={handleDelete}
    />
  );
}
