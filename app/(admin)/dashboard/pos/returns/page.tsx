import { getPosReturnAdminData } from "@/app/actions/pos-returns";
import { PosReturnsManager } from "./PosReturnsManager";

export const dynamic = "force-dynamic";

export default async function PosReturnsPage() {
  const data = await getPosReturnAdminData();
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground md:text-2xl">Retur & Refund POS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Proses retur parsial, refund, pengembalian stok, dan histori audit.</p>
      </div>
      <PosReturnsManager data={data} />
    </div>
  );
}
