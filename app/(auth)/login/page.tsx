// app/(auth)/login/page.tsx
import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';

export const metadata = { title: 'Login | Onetone Store' };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Onetone Store</h1>
          <p className="text-muted-foreground text-sm mt-1">Masuk ke akun kamu</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <LoginForm />

          <p className="text-center text-sm text-muted-foreground mt-6">
            Belum punya akun?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
