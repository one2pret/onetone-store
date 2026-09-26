import { getPosSettings } from "@/app/actions/pos-settings";
import { PosPrintTest } from "@/components/pos/PosPrintTest";

export const dynamic = "force-dynamic";

export default async function PosPrintTestPage() {
  const settings = await getPosSettings();

  return (
    <PosPrintTest
      storeName={settings.storeName}
      storePhone={settings.storePhone}
      storeAddress={settings.storeAddress}
      receiptFooter={settings.receiptFooter}
      receiptLogoUrl={settings.receiptLogoUrl}
    />
  );
}
