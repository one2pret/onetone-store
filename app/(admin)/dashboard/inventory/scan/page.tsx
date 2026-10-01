import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getInventoryScanLocations } from "@/app/actions/inventory-scanning";
import { InventoryReceiptScanner } from "./InventoryReceiptScanner";
import { auth } from "@/lib/auth";
import { InventoryWorkspaceNav } from "../_components/InventoryWorkspaceNav";

export default async function InventoryScanPage() {
  const [locations, session] = await Promise.all([getInventoryScanLocations(), auth()]);
  return (
    <div className="space-y-6">
      <InventoryWorkspaceNav />
      <div className="flex items-start gap-3">
        {session?.user?.role === 'admin' && <Link href="/dashboard/inventory" aria-label="Kembali ke inventori" className="mt-0.5 rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>}
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">Penerimaan & Transfer Barang</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pilih asal barang, scan barcode atau QR, periksa jumlah, lalu konfirmasi satu dokumen.</p>
        </div>
      </div>
      <InventoryReceiptScanner locations={locations} />
    </div>
  );
}
