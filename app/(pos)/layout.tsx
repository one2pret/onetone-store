// app/(pos)/layout.tsx
// Full-screen mobile-first layout untuk kasir. Tidak ada navbar toko —
// kasir fokus 100% pada transaksi. Auth check inline (admin only).

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";

export const metadata = {
  title: "Kasir — Onetone",
};

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    redirect("/login?callbackUrl=/pos");
  }

  return (
    <div className="min-h-svh bg-slate-50 text-slate-900 antialiased flex flex-col">
      <Toaster position="top-center" richColors />
      {children}
    </div>
  );
}
