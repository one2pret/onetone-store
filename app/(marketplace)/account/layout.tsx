// app/(marketplace)/account/layout.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AccountNav } from '@/components/shop/AccountNav';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/account');

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="flex gap-6 md:gap-8 items-start">
          {/* Sidebar — desktop only */}
          <aside className="hidden md:block w-52 shrink-0 sticky top-24">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-3">
              Akun Saya
            </p>
            <AccountNav />
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
