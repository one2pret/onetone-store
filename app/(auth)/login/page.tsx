// app/(auth)/login/page.tsx
'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { login } from '@/app/actions/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Mail, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react';

// Helper isi demo credentials
function fillDemo(email: string, password: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  const emailEl = document.getElementById('email') as HTMLInputElement;
  const passEl  = document.getElementById('password') as HTMLInputElement;
  if (!setter || !emailEl || !passEl) return;
  setter.call(emailEl, email);   emailEl.dispatchEvent(new Event('input', { bubbles: true }));
  setter.call(passEl, password); passEl.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-sm lg:max-w-md animate-fadeInUp">

      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Selamat Datang!
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Masuk ke akun kamu untuk melanjutkan belanja
        </p>
      </div>

      <form action={formAction} className="space-y-5">

        {/* Error alert */}
        {state?.error && (
          <div className="p-3 bg-danger/10 text-danger rounded-xl text-sm
                          border border-danger/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        )}

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="nama@email.com"
              className="pl-11 h-12 rounded-xl bg-input border-border
                         focus:border-primary focus:ring-primary/20 transition-colors"
            />
          </div>
          {state?.errors?.email && (
            <p className="text-danger text-xs mt-1">{state.errors.email[0]}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Masukkan password"
              className="pl-11 pr-11 h-12 rounded-xl bg-input border-border
                         focus:border-primary focus:ring-primary/20 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2
                         text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {state?.errors?.password && (
            <p className="text-danger text-xs mt-1">{state.errors.password[0]}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={pending}
          className="w-full h-12 rounded-xl font-semibold text-sm
                     shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/30
                               border-t-primary-foreground rounded-full animate-spin" />
              Memproses...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Masuk <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>

      {/* Register link */}
      <p className="text-center text-muted-foreground text-sm mt-8">
        Belum punya akun?{' '}
        <Link
          href="/register"
          className="text-primary hover:text-primary-hover font-semibold transition-colors"
        >
          Daftar Sekarang
        </Link>
      </p>

      {/* Demo Credentials */}
      <div className="mt-6 p-4 bg-card rounded-xl border border-border border-dashed">
        <p className="text-xs font-semibold text-muted-foreground mb-3 text-center uppercase tracking-wider">
          Demo Account
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Customer', email: 'rina@gmail.com',     pass: 'password123' },
            { label: 'Admin',    email: 'admin@store.com',    pass: 'password123' },
          ].map((demo) => (
            <button
              key={demo.label}
              type="button"
              onClick={() => fillDemo(demo.email, demo.pass)}
              className="p-2.5 rounded-lg bg-surface border border-border
                         hover:border-primary/40 hover:bg-primary/5
                         transition-all text-center cursor-pointer group"
            >
              <p className="text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors">
                {demo.label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{demo.email}</p>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}