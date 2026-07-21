// app/(pos)/pos/page.tsx
// Router utama POS: kalau ada sesi aktif → tampilkan layar kasir.
// Kalau tidak ada → tampilkan form Buka Kasir.

import { getActiveSession, getCashierUsers } from "@/app/actions/pos-sessions";
import { getPosProducts, getRecentPosOrders } from "@/app/actions/pos-orders";
import { getPosSettings } from "@/app/actions/pos-settings";
import { OpenSessionForm } from "@/components/pos/OpenSessionForm";
import { CashierScreen } from "@/components/pos/CashierScreen";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const [session, authSession, cashiers] = await Promise.all([
    getActiveSession(),
    auth(),
    getCashierUsers(),
  ]);

  if (!session) {
    return (
      <OpenSessionForm
        cashierName={authSession?.user?.name ?? ''}
        currentUserId={Number(authSession?.user?.id ?? 0)}
        cashiers={cashiers}
      />
    );
  }

  const [products, recentOrders, posSettings] = await Promise.all([
    getPosProducts(),
    getRecentPosOrders(session.id, 10),
    getPosSettings(),
  ]);

  return (
    <CashierScreen
      session={session}
      products={products}
      recentOrders={recentOrders}
      qrisUrl={posSettings.qrisUrl}
      receiptFooter={posSettings.receiptFooter}
    />
  );
}
