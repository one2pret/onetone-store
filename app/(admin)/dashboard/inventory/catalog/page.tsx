import { getInventoryProductCatalog } from "@/app/actions/inventory-workspace";
import { InventoryWorkspaceNav } from "../_components/InventoryWorkspaceNav";
import { InventoryProductCatalog } from "./InventoryProductCatalog";

export default async function InventoryCatalogPage() {
  const data = await getInventoryProductCatalog();
  return <div className="space-y-6">
    <InventoryWorkspaceNav />
    <div><h1 className="text-xl font-bold text-foreground md:text-2xl">Katalog Produk</h1><p className="mt-1 text-sm text-muted-foreground">Referensi produk, varian, barcode, dan stok lokasi dalam mode read-only.</p></div>
    {data ? <InventoryProductCatalog data={data} /> : <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Anda belum memiliki lokasi inventori yang dapat diakses.</div>}
  </div>;
}
