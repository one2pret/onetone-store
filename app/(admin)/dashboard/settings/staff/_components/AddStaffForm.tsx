// app/(admin)/dashboard/settings/staff/_components/AddStaffForm.tsx
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createStaffUser } from '@/app/actions/staff';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function AddStaffForm() {
  const [state, formAction, pending] = useActionState(createStaffUser, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success('Staff berhasil ditambahkan');
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name" className="text-sm">Nama Lengkap *</Label>
          <Input id="name" name="name" className="mt-1" placeholder="Budi Santoso" />
          {state?.errors?.name && <p className="text-destructive text-xs mt-0.5">{state.errors.name[0]}</p>}
        </div>
        <div>
          <Label htmlFor="phone" className="text-sm">No. HP</Label>
          <Input id="phone" name="phone" className="mt-1" placeholder="08xx (opsional)" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email" className="text-sm">Email *</Label>
          <Input id="email" name="email" type="email" className="mt-1" placeholder="budi@onetone.id" />
          {state?.errors?.email && <p className="text-destructive text-xs mt-0.5">{state.errors.email[0]}</p>}
        </div>
        <div>
          <Label htmlFor="password" className="text-sm">Password *</Label>
          <Input id="password" name="password" type="password" className="mt-1" placeholder="Min. 6 karakter" />
          {state?.errors?.password && <p className="text-destructive text-xs mt-0.5">{state.errors.password[0]}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Menambahkan...' : 'Tambah Staff'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Staff baru otomatis dapat akses POS dan dashboard admin.
        </p>
      </div>
    </form>
  );
}
