import { getMyInventoryReceiptHistory } from "@/app/actions/inventory-workspace";
import { InventoryWorkspaceNav } from "../_components/InventoryWorkspaceNav";
import { InventoryReceiptHistory } from "./InventoryReceiptHistory";

export default async function InventoryHistoryPage() {
  const history = await getMyInventoryReceiptHistory();
  return <div className="space-y-6">
    <InventoryWorkspaceNav />
    <div><h1 className="text-xl font-bold text-foreground md:text-2xl">Riwayat Saya</h1><p className="mt-1 text-sm text-muted-foreground">Dokumen penerimaan yang Anda konfirmasi, maksimal 100 aktivitas terbaru.</p></div>
    <InventoryReceiptHistory history={history} />
  </div>;
}
