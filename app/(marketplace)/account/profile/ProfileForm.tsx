'use client';

import { useActionState } from 'react';
import { updateProfile } from '@/app/actions/profile';

interface Props {
  name: string;
  email: string;
  phone?: string | null;
}

const initial = { success: false, error: undefined as string | undefined, errors: undefined as Record<string, string[]> | undefined };

export function ProfileForm({ name, email, phone }: Props) {
  const [state, action, pending] = useActionState(updateProfile, initial);

  return (
    <form action={action} className="space-y-4">
      {state.success && (
        <div className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-4 py-3">
          Profil berhasil disimpan.
        </div>
      )}
      {state.error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Nama Lengkap</label>
        <input
          name="name"
          defaultValue={name}
          required
          minLength={2}
          className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none transition"
        />
        {state.errors?.name && (
          <p className="text-xs text-destructive mt-1">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
        <input
          value={email}
          disabled
          className="w-full px-3.5 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground mt-1">Email tidak dapat diubah.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">No. Telepon</label>
        <input
          name="phone"
          defaultValue={phone ?? ''}
          type="tel"
          placeholder="08xx-xxxx-xxxx"
          className="w-full px-3.5 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none transition"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold rounded-lg transition disabled:opacity-60"
      >
        {pending ? 'Menyimpan...' : 'Simpan Perubahan'}
      </button>
    </form>
  );
}
