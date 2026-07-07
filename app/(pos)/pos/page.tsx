// app/(pos)/pos/page.tsx
// Router utama POS: kalau ada sesi aktif → tampilkan layar kasir.
// Kalau tidak ada → tampilkan form Buka Kasir.

import { getActiveSession } from "@/app/actions/pos-sessions";
import { getPosProducts, getRecentPosOrders } from "@/app/actions/pos-orders";
import { getPosSettings } from "@/app/actions/pos-settings";
import { OpenSessionForm } from "@/components/pos/OpenSessionForm";
import { CashierScreen } from "@/components/pos/CashierScreen";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const session = await getActiveSession();

  if (!session) {
    return <OpenSessionForm />;
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
