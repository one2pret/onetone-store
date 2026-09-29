import { getInventoryAdminData } from "@/app/actions/inventory";
import { InventoryManager } from "./InventoryManager";
import Link from "next/link";
import { ScanBarcode } from "lucide-react";

export default async function InventoryPage() {
  const data = await getInventoryAdminData();
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-xl font-bold text-foreground md:text-2xl">Inventori per Lokasi</h1><p className="mt-1 text-sm text-muted-foreground">Atur gudang online dan stok setiap cabang POS secara terpisah.</p></div>
        <Link href="/dashboard/inventory/scan" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ScanBarcode className="h-4 w-4" /> Terima via Scanner</Link>
      </div>
      <InventoryManager data={data} />
    </div>
  );
}
