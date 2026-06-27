// app/(admin)/layout.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminSidebar, SidebarProvider } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || session.user.role !== 'admin') {
    redirect('/login');
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-slate-100">
        <AdminSidebar />
        <div className="lg:pl-[250px]">
          <AdminHeader user={session.user} />
          <main className="p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
