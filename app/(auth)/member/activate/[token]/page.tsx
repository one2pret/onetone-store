import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { PosLeadActivationForm } from '@/components/auth/PosLeadActivationForm';
import { Button } from '@/components/ui/button';
import { getPosLeadActivationInfo } from '@/lib/pos-lead-activation';

export const metadata = { title: 'Aktivasi Member | Onetone Store' };

export default async function PosLeadActivationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = await getPosLeadActivationInfo(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold text-foreground">Onetone Store</h1>
          <p className="mt-1 text-sm text-muted-foreground">Aktivasi membership dari kasir</p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-6">
          {info.valid ? (
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground">Lengkapi akun member</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Buat password untuk login dengan nomor HP. Email dapat ditambahkan bila diinginkan.
                </p>
              </div>
              <PosLeadActivationForm
                token={token}
                name={info.name}
                maskedPhone={info.maskedPhone}
                maskedEmail={info.maskedEmail}
              />
            </>
          ) : (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {info.reason === 'expired' ? 'Tautan sudah kedaluwarsa' : info.reason === 'used' ? 'Tautan sudah digunakan' : 'Tautan tidak valid'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {info.reason === 'expired'
                    ? 'Minta kasir mendaftarkan ulang agar QR aktivasi baru diterbitkan.'
                    : info.reason === 'used'
                      ? 'Akun member sudah pernah diaktifkan. Silakan masuk memakai email atau nomor HP akun tersebut.'
                      : 'Periksa kembali QR atau tautan aktivasi yang diberikan kasir.'}
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Ke halaman masuk</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
