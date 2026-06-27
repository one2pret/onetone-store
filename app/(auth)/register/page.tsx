// app/(auth)/register/page.tsx
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { register } from '@/app/actions/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

type ActionState = {
  success?: boolean;
  errors?: Record<string, string[]>;
} | null;

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(register, null) as [ActionState, any, boolean];
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-sm lg:max-w-md">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Buat Akun Baru</h1>
        <p className="text-slate-500 mt-2 text-sm md:text-base">
          Daftar untuk mulai belanja di NextElektronik
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        {state?.errors?._form && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">&#9888;</span>
            <span>{state.errors._form[0]}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-slate-700">Nama Lengkap</Label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="name"
              name="name"
              type="text"
              required
              className="pl-11 h-12 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 bg-slate-50 focus:bg-white transition"
              placeholder="John Doe"
            />
          </div>
          {state?.errors?.name && (
            <p className="text-red-500 text-xs mt-1">{state.errors.name[0]}</p>
          )}
        </div>

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
          <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
            Nomor HP <span className="text-slate-400 font-normal">(Opsional)</span>
          </Label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              id="phone"
              name="phone"
              type="tel"
              className="pl-11 h-12 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 bg-slate-50 focus:bg-white transition"
              placeholder="08xxxxxxxxxx"
            />
          </div>
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
              placeholder="Minimal 6 karakter"
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

        <div className="pt-1">
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
                Daftar Sekarang
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </div>
      </form>

      <p className="text-center text-slate-500 text-sm mt-8">
        Sudah punya akun?{' '}
        <Link href="/login" className="text-primary hover:text-primary-hover font-semibold">
          Masuk
        </Link>
      </p>
    </div>
  );
}
