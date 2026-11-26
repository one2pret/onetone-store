'use client';

import { useActionState, useEffect, useState, useSyncExternalStore, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createVoucher, updateVoucher, type VoucherActionState } from '@/app/actions/admin-vouchers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { MemberTier, Voucher } from '@/lib/db/schema';

function toDatetimeLocal(value?: Date | null) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const subscribeToNothing = () => () => {};

function FieldError({ errors }: { errors?: string[] }) {
  return errors?.[0] ? <p className="text-xs text-destructive mt-1">{errors[0]}</p> : null;
}

export function VoucherForm({ voucher, tiers, hasHistory = false }: {
  voucher?: Voucher | null;
  tiers: MemberTier[];
  hasHistory?: boolean;
}) {
  const router = useRouter();
  const action = voucher ? updateVoucher.bind(null, voucher.id) : createVoucher;
  const [state, formAction, pending] = useActionState<VoucherActionState, FormData>(action, null);
  const [submitting, startSubmitTransition] = useTransition();
  const [type, setType] = useState(voucher?.type ?? 'fixed');
  const [audience, setAudience] = useState(voucher?.audience ?? 'public');
  const [fields, setFields] = useState(() => ({
    name: voucher?.name ?? '',
    code: voucher?.code ?? '',
    description: voucher?.description ?? '',
    value: String(voucher?.value ?? 0),
    minSpend: String(voucher?.minSpend ?? 0),
    tierId: String(voucher?.tierId ?? ''),
    validDaysAfterGrant: String(voucher?.validDaysAfterGrant ?? 14),
    quota: voucher?.quota == null ? '' : String(voucher.quota),
    maxUsesPerUser: String(voucher?.maxUsesPerUser ?? 1),
    firstOrderOnly: voucher?.firstOrderOnly ?? false,
    allowPoints: voucher?.allowPoints ?? true,
    isActive: voucher?.isActive ?? true,
    startsAt: undefined as string | undefined,
    endsAt: undefined as string | undefined,
  }));

  function setField<K extends keyof typeof fields>(field: K, value: (typeof fields)[K]) {
    setFields(previous => ({ ...previous, [field]: value }));
  }

  // Server and browser may use different timezones. Use the server snapshot
  // during hydration, then display the initial date in the browser timezone.
  // Once edited, the controlled value survives Server Action validation errors.
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Submit the snapshot explicitly. React auto-resets a form with action={...}
    // even when the server returns validation errors (which loses selected inputs).
    const formData = new FormData(event.currentTarget);
    formData.set('timezoneOffsetMinutes', String(new Date().getTimezoneOffset()));
    startSubmitTransition(() => formAction(formData));
  }

  useEffect(() => {
    if (!state) return;
    if (!state.success) {
      if (state.error) toast.error(state.error);
      return;
    }
    toast.success(voucher ? 'Voucher diperbarui' : 'Voucher dibuat');
    router.push('/dashboard/vouchers');
    router.refresh();
  }, [state, router, voucher]);

  return (
    <form onSubmit={handleFormSubmit} className="max-w-4xl space-y-6">
      {state?.error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.error}</div>
      )}
      {hasHistory && (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Voucher sudah memiliki histori. Kode, tipe, nilai, dan audience dikunci untuk menjaga audit order lama.
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="text-base font-semibold text-foreground">Identitas campaign</h2>
        <div className="grid gap-4 mt-4 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Nama voucher</Label>
            <Input id="name" name="name" required value={fields.name} onChange={event => setField('name', event.target.value)} className="mt-1" placeholder="Voucher pengguna baru Rp5.000" />
            <FieldError errors={state?.errors?.name} />
          </div>
          <div>
            <Label htmlFor="code">Kode voucher</Label>
            <Input id="code" name="code" required value={fields.code} onChange={event => setField('code', event.target.value)} disabled={hasHistory} className="mt-1 font-mono uppercase" placeholder="WELCOME5000" />
            {hasHistory && <input type="hidden" name="code" value={voucher?.code} />}
            <FieldError errors={state?.errors?.code} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Deskripsi internal</Label>
            <Textarea id="description" name="description" rows={3} value={fields.description} onChange={event => setField('description', event.target.value)} className="mt-1" placeholder="Tujuan campaign dan catatan untuk tim." />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="text-base font-semibold text-foreground">Benefit dan syarat belanja</h2>
        <div className="grid gap-4 mt-4 md:grid-cols-3">
          <div>
            <Label htmlFor="type">Tipe benefit</Label>
            <select id="type" name="type" value={type} disabled={hasHistory} onChange={(event) => setType(event.target.value as typeof type)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="fixed">Potongan nominal</option>
              <option value="percent">Potongan persen</option>
              <option value="free_shipping">Gratis ongkir</option>
            </select>
            {hasHistory && <input type="hidden" name="type" value={type} />}
          </div>
          <div>
            <Label htmlFor="value">{type === 'percent' ? 'Persentase' : 'Nilai diskon (Rp)'}</Label>
            <Input id="value" name="value" type="number" min="0" max={type === 'percent' ? 100 : undefined} required={type !== 'free_shipping'} disabled={type === 'free_shipping' || hasHistory} value={fields.value} onChange={event => setField('value', event.target.value)} className="mt-1" />
            {(type === 'free_shipping' || hasHistory) && <input type="hidden" name="value" value={type === 'free_shipping' ? 0 : voucher?.value ?? 0} />}
            <FieldError errors={state?.errors?.value} />
          </div>
          <div>
            <Label htmlFor="minSpend">Minimum belanja (Rp)</Label>
            <Input id="minSpend" name="minSpend" type="number" min="0" value={fields.minSpend} onChange={event => setField('minSpend', event.target.value)} className="mt-1" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="text-base font-semibold text-foreground">Audience dan batas penggunaan</h2>
        <div className="grid gap-4 mt-4 md:grid-cols-3">
          <div>
            <Label htmlFor="audience">Audience</Label>
            <select id="audience" name="audience" value={audience} disabled={hasHistory} onChange={(event) => setAudience(event.target.value as typeof audience)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="public">Publik</option>
              <option value="membership">Membership</option>
              <option value="new_user">Pengguna baru</option>
            </select>
            {hasHistory && <input type="hidden" name="audience" value={audience} />}
          </div>
          {audience === 'membership' && (
            <div>
              <Label htmlFor="tierId">Tier minimum</Label>
              <select id="tierId" name="tierId" value={fields.tierId} onChange={event => setField('tierId', event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Pilih tier</option>
                {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
              </select>
              <FieldError errors={state?.errors?.tierId} />
            </div>
          )}
          {audience === 'new_user' && (
            <div>
              <Label htmlFor="validDaysAfterGrant">Berlaku setelah diberikan</Label>
              <div className="relative mt-1"><Input id="validDaysAfterGrant" name="validDaysAfterGrant" type="number" min="1" value={fields.validDaysAfterGrant} onChange={event => setField('validDaysAfterGrant', event.target.value)} className="pr-14" /><span className="absolute right-3 top-2 text-xs text-muted-foreground">hari</span></div>
              <FieldError errors={state?.errors?.validDaysAfterGrant} />
            </div>
          )}
          <div>
            <Label htmlFor="quota">Kuota global</Label>
            <Input id="quota" name="quota" type="number" min="1" value={fields.quota} onChange={event => setField('quota', event.target.value)} className="mt-1" placeholder="Kosong berarti tanpa batas" />
          </div>
          <div>
            <Label htmlFor="maxUsesPerUser">Maksimal per user</Label>
            <Input id="maxUsesPerUser" name="maxUsesPerUser" type="number" min="1" value={fields.maxUsesPerUser} onChange={event => setField('maxUsesPerUser', event.target.value)} className="mt-1" />
          </div>
        </div>

        <div className="grid gap-3 mt-5 md:grid-cols-3">
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" name="firstOrderOnly" checked={fields.firstOrderOnly} onChange={event => setField('firstOrderOnly', event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span><span className="block text-sm font-medium text-foreground">Order pertama saja</span><span className="block text-xs text-muted-foreground mt-0.5">Tolak jika user sudah pernah membayar order.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" name="allowPoints" checked={fields.allowPoints} onChange={event => setField('allowPoints', event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span><span className="block text-sm font-medium text-foreground">Boleh dengan poin</span><span className="block text-xs text-muted-foreground mt-0.5">Izinkan redeem poin pada order yang sama.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" name="isActive" checked={fields.isActive} onChange={event => setField('isActive', event.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span><span className="block text-sm font-medium text-foreground">Campaign aktif</span><span className="block text-xs text-muted-foreground mt-0.5">Voucher dapat ditemukan dan digunakan.</span></span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="text-base font-semibold text-foreground">Jadwal campaign</h2>
        <div className="grid gap-4 mt-4 md:grid-cols-2">
          <div><Label htmlFor="startsAt">Mulai</Label><Input id="startsAt" name="startsAt" type="datetime-local" value={fields.startsAt ?? (hydrated ? toDatetimeLocal(voucher?.startsAt) : '')} onChange={event => setField('startsAt', event.target.value)} className="mt-1" /><FieldError errors={state?.errors?.startsAt} /></div>
          <div><Label htmlFor="endsAt">Selesai</Label><Input id="endsAt" name="endsAt" type="datetime-local" value={fields.endsAt ?? (hydrated ? toDatetimeLocal(voucher?.endsAt) : '')} onChange={event => setField('endsAt', event.target.value)} className="mt-1" /><FieldError errors={state?.errors?.endsAt} /></div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || submitting}>{pending || submitting ? 'Menyimpan...' : voucher ? 'Simpan Perubahan' : 'Buat Voucher'}</Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/dashboard/vouchers')}>Batal</Button>
      </div>
    </form>
  );
}
