// app/(admin)/dashboard/products/_components/DeleteProductButton.tsx
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
      if (result.mode === 'archived') {
        toast.info(result.message);
        setLoading(false);
      } else {
        toast.success(result.message);
      }
      router.refresh();
    } else {
      toast.error(result.error || 'Gagal hapus produk');
      setLoading(false);
    }
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon" disabled={loading} title="Hapus produk">
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      }
      title="Hapus Produk"
      description={`Yakin ingin menghapus produk "${name}"? Produk dengan riwayat stok atau transaksi akan dinonaktifkan agar data audit tetap aman.`}
      confirmLabel="Hapus / Nonaktifkan"
      variant="destructive"
      onConfirm={handleDelete}
    />
  );
}
