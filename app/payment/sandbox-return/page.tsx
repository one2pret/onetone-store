import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kembali ke OneTone Mobile — Pembayaran TEST',
  description: 'Halaman kembali dari Xendit Test Mode. Status pembayaran dilihat di aplikasi OneTone.',
  robots: { index: false, follow: false },
};

/**
 * Neutral landing page for BOTH Xendit TEST success and failure redirects.
 * Never load/display an order ID, account name, invoice, address or payment
 * result here. Chrome has independent credentials from the Android app.
 * The authenticated app and server webhook are the only sources of truth.
 */
export default function SandboxPaymentReturnPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5">
        <div className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold tracking-wide">
          ONETONE — MODE UJI COBA
        </div>
        <h1 className="text-2xl font-bold leading-snug">
          Kembali ke aplikasi OneTone
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Anda telah meninggalkan halaman pembayaran Xendit TEST.
          Halaman ini tidak memastikan bahwa pembayaran berhasil atau gagal.
        </p>
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <p className="font-semibold">Cara memeriksa status</p>
          <ol className="list-decimal pl-5 text-sm space-y-2">
            <li>Kembali ke aplikasi OneTone Mobile melalui daftar aplikasi terbaru.</li>
            <li>Buka halaman <strong>Pesanan TEST</strong> yang tadi digunakan.</li>
            <li>Tekan <strong>Perbarui Status Pesanan</strong>.</li>
          </ol>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Status resmi hanya berasal dari server OneTone setelah konfirmasi
          pembayaran Xendit. Jangan membuat pesanan baru hanya karena halaman
          ini terbuka.
        </p>
      </section>
    </main>
  );
}
