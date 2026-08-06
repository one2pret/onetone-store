// app/(admin)/dashboard/settings/staff/_components/AddStaffForm.tsx
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createStaffUser } from '@/app/actions/staff';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export function AddStaffForm() {
  const [state, formAction, pending] = useActionState(createStaffUser, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);

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
          <div className="relative mt-1">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className="pr-10"
              placeholder="Min. 6 karakter"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              aria-pressed={showPassword}
              className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-lg"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {state?.errors?.password && <p className="text-destructive text-xs mt-0.5">{state.errors.password[0]}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="role" className="text-sm">Akses Role *</Label>
        <select id="role" name="role" defaultValue="cashier"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="cashier">Kasir — hanya akses POS</option>
          <option value="admin">Admin — akses penuh dashboard + POS</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Kasir hanya bisa login ke halaman POS. Admin bisa akses seluruh dashboard.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Menambahkan...' : 'Tambah Staff'}
      </Button>
    </form>
  );
}
