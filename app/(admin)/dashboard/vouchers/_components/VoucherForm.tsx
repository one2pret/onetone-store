'use client';

import { useActionState, useEffect, useState } from 'react';
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
  const [type, setType] = useState(voucher?.type ?? 'fixed');
  const [audience, setAudience] = useState(voucher?.audience ?? 'public');

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
    <form action={formAction} className="max-w-4xl space-y-6">
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
            <Input id="name" name="name" required defaultValue={voucher?.name ?? ''} className="mt-1" placeholder="Voucher pengguna baru Rp5.000" />
            <FieldError errors={state?.errors?.name} />
          </div>
          <div>
            <Label htmlFor="code">Kode voucher</Label>
            <Input id="code" name="code" required defaultValue={voucher?.code ?? ''} disabled={hasHistory} className="mt-1 font-mono uppercase" placeholder="WELCOME5000" />
            {hasHistory && <input type="hidden" name="code" value={voucher?.code} />}
            <FieldError errors={state?.errors?.code} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Deskripsi internal</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={voucher?.description ?? ''} className="mt-1" placeholder="Tujuan campaign dan catatan untuk tim." />
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
            <Input id="value" name="value" type="number" min="0" max={type === 'percent' ? 100 : undefined} required={type !== 'free_shipping'} disabled={type === 'free_shipping' || hasHistory} defaultValue={voucher?.value ?? 0} className="mt-1" />
            {(type === 'free_shipping' || hasHistory) && <input type="hidden" name="value" value={type === 'free_shipping' ? 0 : voucher?.value ?? 0} />}
            <FieldError errors={state?.errors?.value} />
          </div>
          <div>
            <Label htmlFor="minSpend">Minimum belanja (Rp)</Label>
            <Input id="minSpend" name="minSpend" type="number" min="0" defaultValue={voucher?.minSpend ?? 0} className="mt-1" />
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
              <select id="tierId" name="tierId" defaultValue={voucher?.tierId ?? ''} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Pilih tier</option>
                {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
              </select>
              <FieldError errors={state?.errors?.tierId} />
            </div>
          )}
          {audience === 'new_user' && (
            <div>
              <Label htmlFor="validDaysAfterGrant">Berlaku setelah diberikan</Label>
              <div className="relative mt-1"><Input id="validDaysAfterGrant" name="validDaysAfterGrant" type="number" min="1" defaultValue={voucher?.validDaysAfterGrant ?? 14} className="pr-14" /><span className="absolute right-3 top-2 text-xs text-muted-foreground">hari</span></div>
              <FieldError errors={state?.errors?.validDaysAfterGrant} />
            </div>
          )}
          <div>
            <Label htmlFor="quota">Kuota global</Label>
            <Input id="quota" name="quota" type="number" min="1" defaultValue={voucher?.quota ?? ''} className="mt-1" placeholder="Kosong berarti tanpa batas" />
          </div>
          <div>
            <Label htmlFor="maxUsesPerUser">Maksimal per user</Label>
            <Input id="maxUsesPerUser" name="maxUsesPerUser" type="number" min="1" defaultValue={voucher?.maxUsesPerUser ?? 1} className="mt-1" />
          </div>
        </div>

        <div className="grid gap-3 mt-5 md:grid-cols-3">
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" name="firstOrderOnly" defaultChecked={voucher?.firstOrderOnly ?? false} className="mt-0.5 h-4 w-4 accent-primary" />
            <span><span className="block text-sm font-medium text-foreground">Order pertama saja</span><span className="block text-xs text-muted-foreground mt-0.5">Tolak jika user sudah pernah membayar order.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" name="allowPoints" defaultChecked={voucher?.allowPoints ?? true} className="mt-0.5 h-4 w-4 accent-primary" />
            <span><span className="block text-sm font-medium text-foreground">Boleh dengan poin</span><span className="block text-xs text-muted-foreground mt-0.5">Izinkan redeem poin pada order yang sama.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input type="checkbox" name="isActive" defaultChecked={voucher?.isActive ?? true} className="mt-0.5 h-4 w-4 accent-primary" />
            <span><span className="block text-sm font-medium text-foreground">Campaign aktif</span><span className="block text-xs text-muted-foreground mt-0.5">Voucher dapat ditemukan dan digunakan.</span></span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="text-base font-semibold text-foreground">Jadwal campaign</h2>
        <div className="grid gap-4 mt-4 md:grid-cols-2">
          <div><Label htmlFor="startsAt">Mulai</Label><Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toDatetimeLocal(voucher?.startsAt)} className="mt-1" /></div>
          <div><Label htmlFor="endsAt">Selesai</Label><Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toDatetimeLocal(voucher?.endsAt)} className="mt-1" /><FieldError errors={state?.errors?.endsAt} /></div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? 'Menyimpan...' : voucher ? 'Simpan Perubahan' : 'Buat Voucher'}</Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/dashboard/vouchers')}>Batal</Button>
      </div>
    </form>
  );
}
