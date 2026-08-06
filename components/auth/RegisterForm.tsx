'use client';
// components/auth/RegisterForm.tsx
import { useActionState, useState } from 'react';
import { register } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

const initialState = { success: false, error: '', errors: undefined };

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Daftar Akun</h2>

      {/* Global error */}
      {state?.error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      {/* Nama */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nama Lengkap</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Nama kamu"
          autoComplete="name"
          disabled={isPending}
          className={state?.errors?.name ? 'border-destructive' : ''}
        />
        {state?.errors?.name && (
          <p className="text-xs text-destructive">{state.errors.name[0]}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="kamu@email.com"
          autoComplete="email"
          disabled={isPending}
          className={state?.errors?.email ? 'border-destructive' : ''}
        />
        {state?.errors?.email && (
          <p className="text-xs text-destructive">{state.errors.email[0]}</p>
        )}
      </div>

      {/* No. HP (optional) */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">No. HP <span className="text-muted-foreground">(opsional)</span></Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="08xxxxxxxxxx"
          autoComplete="tel"
          disabled={isPending}
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimal 6 karakter"
            autoComplete="new-password"
            disabled={isPending}
            className={`pr-10 ${state?.errors?.password ? 'border-destructive' : ''}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={isPending}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            aria-pressed={showPassword}
            className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-lg"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {state?.errors?.password && (
          <p className="text-xs text-destructive">{state.errors.password[0]}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</>
        ) : 'Buat Akun'}
      </Button>
    </form>
  );
}
