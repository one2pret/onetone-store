import { redirect } from "next/navigation";
import { requirePosAdmin } from "@/lib/pos-auth";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const auth = await requirePosAdmin();
  if (!auth.ok) redirect("/login");
  return children;
}
