'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { bookSandboxShipment, previewSandboxBooking, reconcileSandboxShipment } from '@/app/actions/sandbox-booking';
import type { SandboxPayload } from '@/lib/checkout/sandbox-booking';

type Booking = { status: string; referenceId: string; externalOrderId: string | null;
  waybillId: string | null; courierTrackingId: string | null };
export function SandboxBookingPanel({ orderId, enabled, booking }: {
  orderId: number; enabled: boolean; booking: Booking | null;
}) {
  const router = useRouter();
  const [review, setReview] = useState<{ payload: SandboxPayload; hash: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [externalId, setExternalId] = useState('');
  const [attempted, setAttempted] = useState(false);

  async function preview() {
    setBusy(true); setReview(null); setConfirmed(false); setMessage('');
    try {
      const result = await previewSandboxBooking(orderId);
      if (result.success) setReview(result);
      else setMessage(result.error);
    } catch { setMessage('Review gagal dimuat. Muat ulang halaman.'); }
    finally { setBusy(false); }
  }
  async function book() {
    if (!review || !confirmed) return;
    setBusy(true); setAttempted(true); setMessage('');
    try {
      const result = await bookSandboxShipment(orderId, review.hash, confirmed);
      setMessage(result.success ? `Hasil booking: ${result.status}. Booking bukan bukti pickup.` : result.error);
      setReview(null); setConfirmed(false); router.refresh();
    } catch { setMessage('Hasil belum diketahui. Muat ulang untuk memeriksa reservasi; jangan kirim ulang.'); }
    finally { setBusy(false); }
  }
  async function reconcile() {
    setBusy(true); setMessage('');
    try {
      const result = await reconcileSandboxShipment(orderId, externalId);
      setMessage(result.success ? `Hasil pemeriksaan: ${result.status}.` : result.error);
      router.refresh();
    } catch { setMessage('Pemeriksaan gagal. Reservasi tetap diblokir.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 border-t border-border pt-3">
    <p className="font-medium">Booking Biteship TESTING</p>
    {!enabled && !booking && <p>Booking baru dinonaktifkan. Gate staging/test dan kredensial khusus TEST wajib valid.</p>}
    {!enabled && booking && <p>Reservasi TEST tersimpan. Booking baru dan pemeriksaan GET dinonaktifkan; riwayat tetap tersedia.</p>}
    {booking ? <>
      <dl className="space-y-1 break-words">
        <div><dt className="font-medium">Status</dt><dd>{booking.status}</dd></div>
        <div><dt className="font-medium">Reference</dt><dd>{booking.referenceId}</dd></div>
        <div><dt className="font-medium">ID order Biteship</dt><dd>{booking.externalOrderId || 'Belum terverifikasi'}</dd></div>
        <div><dt className="font-medium">Waybill</dt><dd>{booking.waybillId || 'Belum tersedia'}</dd></div>
        <div><dt className="font-medium">Tracking kurir</dt><dd>{booking.courierTrackingId || 'Belum tersedia'}</dd></div>
      </dl>
      <p>Reservasi sudah ada. POST ulang diblokir. Booking terkonfirmasi belum berarti paket dijemput.</p>
      {!booking.externalOrderId && <label className="block space-y-1">
        <span>ID order dari dashboard Biteship Testing untuk rekonsiliasi</span>
        <input value={externalId} onChange={event => setExternalId(event.target.value)} disabled={busy || !enabled}
          className="block w-full rounded-md border border-input bg-background p-2 focus-visible:outline-2 focus-visible:outline-ring" />
      </label>}
      <Button type="button" variant="outline" className="cursor-pointer whitespace-normal h-auto min-h-10" disabled={busy || !enabled || (!booking.externalOrderId && !externalId.trim())} onClick={reconcile}>
        Periksa booking lewat GET
      </Button>
    </> : <>
      <p>Tinjau snapshot sebelum konfirmasi. Berat berasal dari checkout; order lama tanpa snapshot ditolak.</p>
      <Button type="button" variant="outline" className="cursor-pointer" disabled={busy || !enabled || attempted} onClick={preview}>Tinjau snapshot booking</Button>
      {review && <div className="space-y-3 break-words">
        <p><strong>Pickup:</strong> {review.payload.origin_contact_name}, {review.payload.origin_contact_phone}, {review.payload.origin_address} ({review.payload.origin_coordinate.latitude}, {review.payload.origin_coordinate.longitude})</p>
        <p><strong>Tujuan:</strong> {review.payload.destination_contact_name}, {review.payload.destination_contact_phone}, {review.payload.destination_address} ({review.payload.destination_coordinate.latitude}, {review.payload.destination_coordinate.longitude})</p>
        <p><strong>Layanan:</strong> {review.payload.courier_company} / {review.payload.courier_type}</p>
        <ul className="space-y-1">{review.payload.items.map((item, index) => <li key={index}>{item.name}: {item.quantity} × {item.weight} gram, IDR {item.value} per unit</li>)}</ul>
        <p>Total berat: {review.payload.items.reduce((sum, item) => sum + item.weight * item.quantity, 0)} gram.</p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />
          <span>Saya sudah meninjau snapshot dan mengizinkan satu booking TESTING.</span>
        </label>
        <Button type="button" className="cursor-pointer whitespace-normal h-auto min-h-10" disabled={!confirmed || busy || !enabled || attempted} onClick={book}>Konfirmasi satu booking TESTING</Button>
      </div>}
    </>}
    {busy && <p role="status">Memproses permintaan…</p>}
    {message && <p role="status">{message}</p>}
  </div>;
}
