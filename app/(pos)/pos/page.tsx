// app/(pos)/pos/page.tsx
// Router utama POS: kalau ada sesi aktif → tampilkan layar kasir.
// Kalau tidak ada → tampilkan form Buka Kasir.

import { getActiveSession } from "@/app/actions/pos-sessions";
import { getPosProducts, getRecentPosOrders } from "@/app/actions/pos-orders";
import { getPosSettings } from "@/app/actions/pos-settings";
import { OpenSessionForm } from "@/components/pos/OpenSessionForm";
import { CashierScreen } from "@/components/pos/CashierScreen";
import { auth } from "@/lib/auth";
import { getActivePosLocations } from "@/app/actions/inventory";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const [session, authSession, locations] = await Promise.all([
    getActiveSession(),
    auth(),
    getActivePosLocations(),
  ]);

  if (!session) {
    return (
      <OpenSessionForm
        cashierName={authSession?.user?.name ?? ''}
        locations={locations}
      />
    );
  }

  const [products, recentOrders, posSettings] = await Promise.all([
    getPosProducts(session.locationId ?? undefined),
    getRecentPosOrders(session.id, 10),
    getPosSettings(),
  ]);

  // Identitas header mengikuti akun yang sedang login. Nama pada sesi lama
  // hanya menjadi fallback bila data autentikasi tidak menyediakan nama.
  const cashierName = authSession?.user?.name ?? session.assignedCashierName ?? '';
  const locationName = locations.find(location => location.id === session.locationId)?.name ?? "Lokasi POS";

  return (
    <CashierScreen
      session={session}
      products={products}
      recentOrders={recentOrders}
      qrisUrl={posSettings.qrisUrl}
      receiptFooter={posSettings.receiptFooter}
      cashierName={cashierName}
      locationName={locationName}
      maxDiscountPercent={(authSession?.user as { role?: string } | undefined)?.role === "admin" ? 100 : 20}
      storeName={posSettings.storeName}
      storePhone={posSettings.storePhone}
      storeAddress={posSettings.storeAddress}
      receiptLogoUrl={posSettings.receiptLogoUrl}
    />
  );
}
