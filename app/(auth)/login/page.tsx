// app/(auth)/login/page.tsx
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { login } from '@/app/actions/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-sm lg:max-w-md">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Selamat Datang!</h1>
        <p className="text-slate-500 mt-2 text-sm md:text-base">
          Masuk ke akun Anda untuk melanjutkan belanja
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {state?.error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">&#9888;</span>
            <span>{state.error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="email"
              name="email"
              type="email"
              required
              className="pl-11 h-12 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 bg-slate-50 focus:bg-white transition"
              placeholder="nama@email.com"
            />
          </div>
          {state?.errors?.email && (
            <p className="text-red-500 text-xs mt-1">{state.errors.email[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              className="pl-11 pr-11 h-12 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 bg-slate-50 focus:bg-white transition"
              placeholder="Masukkan password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {state?.errors?.password && (
            <p className="text-red-500 text-xs mt-1">{state.errors.password[0]}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl text-sm shadow-lg shadow-primary/20 transition-all"
        >
          {pending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Memproses...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Masuk
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="text-center text-slate-500 text-sm mt-8">
        Belum punya akun?{' '}
        <Link href="/register" className="text-primary hover:text-primary-hover font-semibold">
          Daftar Sekarang
        </Link>
      </p>

      {/* Demo credentials */}
      <div className="mt-6 p-4 bg-slate-50 lg:bg-white rounded-xl border border-dashed border-slate-200">
        <p className="text-xs font-semibold text-slate-500 mb-2 text-center">Demo Account</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              const emailInput = document.getElementById('email') as HTMLInputElement;
              const passInput = document.getElementById('password') as HTMLInputElement;
              if (emailInput && passInput) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                nativeInputValueSetter?.call(emailInput, 'rina@gmail.com');
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                nativeInputValueSetter?.call(passInput, 'password123');
                passInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }}
            className="p-2.5 rounded-lg bg-white lg:bg-slate-50 border border-slate-200 hover:border-primary/30 hover:bg-primary/5 transition text-center cursor-pointer"
          >
            <p className="text-[11px] font-medium text-slate-600">Customer</p>
            <p className="text-[10px] text-slate-400 mt-0.5">rina@gmail.com</p>
          </button>
          <button
            type="button"
            onClick={() => {
              const emailInput = document.getElementById('email') as HTMLInputElement;
              const passInput = document.getElementById('password') as HTMLInputElement;
              if (emailInput && passInput) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                nativeInputValueSetter?.call(emailInput, 'admin@store.com');
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                nativeInputValueSetter?.call(passInput, 'password123');
                passInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }}
            className="p-2.5 rounded-lg bg-white lg:bg-slate-50 border border-slate-200 hover:border-primary/30 hover:bg-primary/5 transition text-center cursor-pointer"
          >
            <p className="text-[11px] font-medium text-slate-600">Admin</p>
            <p className="text-[10px] text-slate-400 mt-0.5">admin@store.com</p>
          </button>
        </div>
      </div>
    </div>
  );
}
