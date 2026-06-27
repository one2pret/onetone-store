// app/(admin)/products/_components/DeleteProductButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProduct } from '@/app/actions/products';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface Props {
  id: number;
  name: string;
}

export function DeleteProductButton({ id, name }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const result = await deleteProduct(id);

    if (result.success) {
      toast.success('Produk berhasil dihapus');
      router.refresh();
    } else {
      toast.error(result.error || 'Gagal hapus produk');
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
      title="Hapus Produk"
      description={`Yakin ingin menghapus produk "${name}"? Tindakan ini tidak dapat dibatalkan.`}
      confirmLabel="Ya, Hapus"
      variant="destructive"
      onConfirm={handleDelete}
    />
  );
}
