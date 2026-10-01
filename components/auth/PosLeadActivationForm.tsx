'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { activatePosLead, type PosLeadActivationState } from '@/app/actions/pos-lead-activation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: PosLeadActivationState = { success: false };

export function PosLeadActivationForm({
  token,
  name,
  maskedPhone,
  maskedEmail,
}: {
  token: string;
  name: string;
  maskedPhone: string;
  maskedEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState(activatePosLead, initialState);
  const [showPassword, setShowPassword] = useState(false);

  if (state.success) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Akun member sudah aktif</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Masuk dengan <span className="font-medium text-foreground">{state.loginIdentifier ?? maskedPhone}</span> untuk melihat benefit member.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-left text-sm">
          <p className="font-semibold text-foreground">
            {state.welcomeVoucherCount
              ? `${state.welcomeVoucherCount} voucher member baru sudah diberikan.`
              : 'Belum ada program voucher member baru yang aktif.'}
          </p>
          {!!state.linkedOrderCount && (
            <p className="mt-1 text-muted-foreground">
              {state.linkedOrderCount} transaksi POS sebelumnya sudah ditautkan ke akun ini.
            </p>
          )}
          {!!state.pointsEarned && (
            <p className="mt-1 text-muted-foreground">
              {state.pointsEarned.toLocaleString('id-ID')} poin dari transaksi POS sudah masuk.
            </p>
          )}
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Masuk ke akun</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[maskedPhone, maskedEmail].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      {state.error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="activation-email">Email untuk login <span className="font-normal text-muted-foreground">(opsional)</span></Label>
        <Input
          id="activation-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Kosongkan jika ingin login dengan nomor HP"
          disabled={pending}
          aria-invalid={!!state.errors?.email}
          className={state.errors?.email ? 'border-destructive' : ''}
        />
        {state.errors?.email && <p className="text-xs text-destructive">{state.errors.email[0]}</p>}
        {!state.errors?.email && <p className="text-xs text-muted-foreground">Tanpa email, Anda tetap dapat masuk menggunakan nomor HP yang didaftarkan kasir.</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="activation-password">Buat password</Label>
        <div className="relative">
          <Input
            id="activation-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            minLength={8}
            maxLength={72}
            required
            disabled={pending}
            aria-invalid={!!state.errors?.password}
            className={`pr-10 ${state.errors?.password ? 'border-destructive' : ''}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(value => !value)}
            disabled={pending}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            className="absolute right-0 top-0 flex h-full w-10 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state.errors?.password && <p className="text-xs text-destructive">{state.errors.password[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="activation-password-confirmation">Ulangi password</Label>
        <Input
          id="activation-password-confirmation"
          name="passwordConfirmation"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          disabled={pending}
          aria-invalid={!!state.errors?.passwordConfirmation}
          className={state.errors?.passwordConfirmation ? 'border-destructive' : ''}
        />
        {state.errors?.passwordConfirmation && (
          <p className="text-xs text-destructive">{state.errors.passwordConfirmation[0]}</p>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Dengan mengaktifkan akun, data pendaftaran dari kasir akan dikonversi menjadi akun customer dan membership aktif.
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengaktifkan...</> : 'Aktifkan akun member'}
      </Button>
    </form>
  );
}
