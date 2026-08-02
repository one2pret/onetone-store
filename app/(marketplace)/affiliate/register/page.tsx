// app/(marketplace)/affiliate/register/page.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getMyAffiliate } from '@/app/actions/affiliate';
import { RegisterForm } from './RegisterForm';

export default async function AffiliateRegisterPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/affiliate/register');

  const existing = await getMyAffiliate();
  if (existing) redirect('/affiliate/dashboard');

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div>
        <Link
          href="/affiliate"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl font-bold text-foreground">Daftar Jadi Affiliate</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Isi data di bawah, tim kami review dalam 1-2 hari kerja.
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
