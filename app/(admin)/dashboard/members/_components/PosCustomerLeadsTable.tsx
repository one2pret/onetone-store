'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Copy, QrCode, Store, Trash2, UserRoundPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { cancelPosCustomerLead, reissuePosCustomerLeadActivation } from '@/app/actions/pos-members';

type PosCustomerLeadRow = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  status: 'pending' | 'activated' | 'cancelled' | 'expired';
  consentAt: Date;
  marketingConsentAt: Date | null;
  activationExpiresAt: Date | null;
  createdAt: Date;
  createdByName: string | null;
  locationName: string | null;
  claimedUserId: number | null;
};

const statusStyles: Record<PosCustomerLeadRow['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  activated: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-zinc-100 text-zinc-600',
  expired: 'bg-rose-100 text-rose-700',
};

const statusLabels: Record<PosCustomerLeadRow['status'], string> = {
  pending: 'Menunggu aktivasi',
  activated: 'Aktif',
  cancelled: 'Dibatalkan',
  expired: 'Kedaluwarsa',
};

function displayPhone(phone: string) {
  return phone.startsWith('62') ? `+${phone}` : phone;
}

export function PosCustomerLeadsTable({ data }: { data: PosCustomerLeadRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activation, setActivation] = useState<{ leadName: string; url: string; qrDataUrl: string; expiresAt: string } | null>(null);

  function reissue(lead: PosCustomerLeadRow) {
    startTransition(async () => {
      const result = await reissuePosCustomerLeadActivation({ leadId: lead.id });
      if (!result.success || !result.activationPath || !result.activationExpiresAt) {
        toast.error(result.success ? 'QR aktivasi tidak tersedia' : result.error);
        return;
      }
      const url = new URL(result.activationPath, window.location.origin).toString();
      try {
        const qrDataUrl = await QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: 'M' });
        setActivation({ leadName: lead.name, url, qrDataUrl, expiresAt: result.activationExpiresAt });
        toast.success('QR baru diterbitkan; QR lama sudah tidak berlaku');
        router.refresh();
      } catch {
        toast.error('QR gagal dibuat');
      }
    });
  }

  function cancel(lead: PosCustomerLeadRow) {
    if (!window.confirm(`Batalkan calon member ${lead.name}? Tautan aktivasi aktif akan langsung dinonaktifkan.`)) return;
    startTransition(async () => {
      const result = await cancelPosCustomerLead({ leadId: lead.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setActivation(current => current?.leadName === lead.name ? null : current);
      toast.success('Calon member dibatalkan');
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 md:px-6">
        <div>
          <div className="flex items-center gap-2">
            <UserRoundPlus className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Calon member dari POS</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Data pelanggan yang didaftarkan kasir dan belum tentu mempunyai akun login.
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{data.length} data</span>
      </div>

      {activation && (
        <div className="border-b border-border bg-sky-50 p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">QR aktivasi baru · {activation.leadName}</p>
              <p className="mt-1 text-xs text-slate-600">Berlaku sampai {new Date(activation.expiresAt).toLocaleString('id-ID')} dan hanya dapat digunakan satu kali.</p>
            </div>
            <button type="button" onClick={() => setActivation(null)} aria-label="Tutup QR" className="rounded-lg p-2 text-slate-500 hover:bg-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Image src={activation.qrDataUrl} alt={`QR aktivasi ${activation.leadName}`} width={152} height={152} unoptimized className="rounded-xl border border-slate-200 bg-white p-2" />
            <div className="min-w-0 space-y-2">
              <button type="button" onClick={async () => {
                try { await navigator.clipboard.writeText(activation.url); toast.success('Tautan aktivasi disalin'); }
                catch { toast.error('Tautan tidak dapat disalin otomatis'); }
              }} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"><Copy className="h-4 w-4" /> Salin tautan</button>
              <p className="break-all text-[11px] text-slate-500">{activation.url}</p>
            </div>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-muted-foreground">
          Belum ada calon member dari POS.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {data.map(lead => (
            <article key={lead.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.4fr_1.3fr_1.2fr_auto] md:items-center md:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{lead.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{displayPhone(lead.phone)}</p>
                {lead.email && <p className="truncate text-xs text-muted-foreground">{lead.email}</p>}
              </div>

              <div className="min-w-0 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 text-foreground">
                  <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{lead.locationName ?? 'Lokasi tidak tersedia'}</span>
                </p>
                <p className="mt-1 truncate">Kasir: {lead.createdByName ?? 'Tidak tersedia'}</p>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>Didaftarkan {formatDate(lead.createdAt)}</p>
                <p className="mt-1">Persetujuan data: tercatat</p>
                <p>Promo: {lead.marketingConsentAt ? 'setuju' : 'tidak'}</p>
                {lead.activationExpiresAt && lead.status === 'pending' && <p>QR: {lead.activationExpiresAt.getTime() > Date.now() ? `aktif sampai ${formatDate(lead.activationExpiresAt)}` : 'kedaluwarsa'}</p>}
              </div>

              <div className="space-y-2 md:text-right">
                <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${statusStyles[lead.status]}`}>
                  {statusLabels[lead.status]}
                </span>
                {lead.claimedUserId && <p className="mt-1 text-[10px] text-muted-foreground">User #{lead.claimedUserId}</p>}
                {(lead.status === 'pending' || lead.status === 'expired') && (
                  <div className="flex flex-wrap gap-1.5 md:justify-end">
                    <button type="button" disabled={pending} onClick={() => reissue(lead)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-accent disabled:opacity-50"><QrCode className="h-3.5 w-3.5" /> Terbitkan QR</button>
                    <button type="button" disabled={pending} onClick={() => cancel(lead)} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Batalkan</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
