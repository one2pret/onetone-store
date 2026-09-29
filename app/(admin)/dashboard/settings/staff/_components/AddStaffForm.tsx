// app/(admin)/dashboard/settings/staff/_components/AddStaffForm.tsx
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createStaffUser } from '@/app/actions/staff';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type Location = { id: number; name: string; code: string; type: string };

export function AddStaffForm({ locations }: { locations: Location[] }) {
  const [state, formAction, pending] = useActionState(createStaffUser, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('cashier');

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
        <select id="role" name="role" value={role} onChange={event => setRole(event.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="cashier">Kasir — hanya akses POS</option>
          <option value="inventory_staff">Staf Inventori — akses lokasi yang dipilih</option>
          <option value="admin">Admin — akses penuh dashboard + POS</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Kasir diarahkan ke POS. Staf inventori diarahkan langsung ke terminal penerimaan.
        </p>
      </div>

      {role === 'inventory_staff' && (
        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">Lokasi yang dapat diakses</legend>
          <p className="mb-3 text-xs text-muted-foreground">Pilih satu atau beberapa lokasi kerja. Akses dapat diubah kapan saja.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {locations.map(location => <label key={location.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 hover:bg-accent"><input type="checkbox" name="locationIds" value={location.id} className="mt-0.5 h-4 w-4 accent-primary" /><span><span className="block text-sm font-medium text-foreground">{location.name}</span><span className="text-xs text-muted-foreground">{location.code} · {location.type}</span></span></label>)}
          </div>
          {state?.errors?.locationIds && <p className="mt-2 text-xs text-destructive">{state.errors.locationIds[0]}</p>}
        </fieldset>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Menambahkan...' : 'Tambah Staff'}
      </Button>
    </form>
  );
}
