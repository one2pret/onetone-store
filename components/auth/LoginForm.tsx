'use client';
// components/auth/LoginForm.tsx
import { useActionState, useState } from 'react';
import { login } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

const initialState = { success: false, error: '', errors: undefined };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Login</h2>

      {/* Global error */}
      {state?.error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      {/* Email atau nomor HP */}
      <div className="space-y-1.5">
        <Label htmlFor="identifier">Email atau nomor HP</Label>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="email"
          placeholder="kamu@email.com atau 08xxxxxxxxxx"
          autoComplete="username"
          disabled={isPending}
          className={state?.errors?.identifier ? 'border-destructive' : ''}
        />
        {state?.errors?.identifier && (
          <p className="text-xs text-destructive">{state.errors.identifier[0]}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
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
        ) : 'Masuk'}
      </Button>
    </form>
  );
}
