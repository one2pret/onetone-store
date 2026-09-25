import { getInventoryAdminData } from "@/app/actions/inventory";
import { InventoryManager } from "./InventoryManager";

export default async function InventoryPage() {
  const data = await getInventoryAdminData();
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground md:text-2xl">Inventori per Lokasi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atur gudang online dan stok setiap cabang POS secara terpisah.</p>
      </div>
      <InventoryManager data={data} />
    </div>
  );
}
