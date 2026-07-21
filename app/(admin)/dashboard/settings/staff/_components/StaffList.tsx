// app/(admin)/dashboard/settings/staff/_components/StaffList.tsx
'use client';

import { useState, useTransition } from 'react';
import { deleteStaffUser, updateStaffUser } from '@/app/actions/staff';
import { formatDate } from '@/lib/utils';
import { Pencil, Trash2, ShieldCheck, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type Staff = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date | null;
};

interface Props {
  staff: Staff[];
  currentUserId: number;
}

function EditForm({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const router = useRouter();
  const action = updateStaffUser.bind(null, staff.id);
  const [state, setState] = useState<any>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await action(null, formData);
      setState(result);
      if (result.success) {
        toast.success('Data staff diperbarui');
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 bg-muted/30 rounded-lg p-4 border border-border">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nama</Label>
          <Input name="name" defaultValue={staff.name} className="mt-1 h-8 text-sm" />
          {state?.errors?.name && <p className="text-destructive text-xs mt-0.5">{state.errors.name[0]}</p>}
        </div>
        <div>
          <Label className="text-xs">No. HP</Label>
          <Input name="phone" defaultValue={staff.phone ?? ''} className="mt-1 h-8 text-sm" placeholder="Opsional" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Password Baru</Label>
        <Input name="password" type="password" className="mt-1 h-8 text-sm" placeholder="Kosongkan jika tidak ubah" />
        {state?.errors?.password && <p className="text-destructive text-xs mt-0.5">{state.errors.password[0]}</p>}
      </div>
      {state?.error && <p className="text-destructive text-xs">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Check className="w-3.5 h-3.5 mr-1" />
          {pending ? 'Menyimpan...' : 'Simpan'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          <X className="w-3.5 h-3.5 mr-1" /> Batal
        </Button>
      </div>
    </form>
  );
}

export function StaffList({ staff, currentUserId }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(id: number) {
    startTransition(async () => {
      const result = await deleteStaffUser(id);
      if (result.success) {
        toast.success('Staff dinonaktifkan');
        setDeletingId(null);
        router.refresh();
      } else {
        toast.error(result.error ?? 'Gagal hapus');
        setDeletingId(null);
      }
    });
  }

  if (staff.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">Belum ada staff terdaftar</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="hidden md:grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-muted/50 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nama</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">No. HP</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dibuat</span>
        <span className="sr-only">Aksi</span>
      </div>

      <div className="divide-y divide-border">
        {staff.map((s) => (
          <div key={s.id} className="px-4 md:px-6 py-4">
            <div className="flex flex-col md:grid md:grid-cols-[2fr_2fr_1fr_1fr_auto] gap-2 md:gap-4 items-start md:items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-sm">{s.name}</span>
                {s.id === currentUserId && (
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Anda</span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{s.email}</span>
              <span className="text-sm text-muted-foreground">{s.phone ?? '—'}</span>
              <span className="text-sm text-muted-foreground">{s.createdAt ? formatDate(s.createdAt) : '—'}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setEditingId(editingId === s.id ? null : s.id)}>
                  <Pencil className="w-3.5 h-3.5 text-primary" />
                </Button>
                {s.id !== currentUserId && (
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => setDeletingId(s.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            </div>

            {editingId === s.id && (
              <EditForm staff={s} onClose={() => setEditingId(null)} />
            )}

            {deletingId === s.id && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive mb-2">Nonaktifkan akun <strong>{s.name}</strong>? Mereka tidak bisa login lagi.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={pending}
                    onClick={() => handleDelete(s.id)}>
                    {pending ? 'Memproses...' : 'Ya, Nonaktifkan'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>Batal</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
