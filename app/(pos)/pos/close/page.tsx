// app/(pos)/pos/close/page.tsx
// Halaman tutup kasir — server page: fetch sesi aktif + summary, lalu render form.

import { redirect } from "next/navigation";
import { getActiveSession, getSessionSummary } from "@/app/actions/pos-sessions";
import { CloseSessionForm } from "@/components/pos/CloseSessionForm";

export const dynamic = "force-dynamic";

export default async function CloseSessionPage() {
  const session = await getActiveSession();
  if (!session) {
    redirect("/pos");
  }

  const summary = await getSessionSummary(session.id);
  if (!summary) {
    redirect("/pos");
  }

  return <CloseSessionForm summary={summary} />;
}
