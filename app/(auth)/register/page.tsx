// app/(auth)/register/page.tsx
import { RegisterForm } from '@/components/auth/RegisterForm';
import Link from 'next/link';

export const metadata = { title: 'Daftar | Onetone Store' };

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Onetone Store</h1>
          <p className="text-muted-foreground text-sm mt-1">Buat akun baru</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <RegisterForm />

          <p className="text-center text-sm text-muted-foreground mt-6">
            Sudah punya akun?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
