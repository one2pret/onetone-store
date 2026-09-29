"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, PackageSearch, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard/inventory/scan", label: "Terima Barang", icon: ScanBarcode },
  { href: "/dashboard/inventory/history", label: "Riwayat Saya", icon: History },
  { href: "/dashboard/inventory/catalog", label: "Katalog Produk", icon: PackageSearch },
];

export function InventoryWorkspaceNav() {
  const pathname = usePathname();
  return <nav aria-label="Menu inventori" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
    {items.map(item => {
      const active = pathname.startsWith(item.href);
      return <Link key={item.href} href={item.href} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}><item.icon className="h-4 w-4" />{item.label}</Link>;
    })}
  </nav>;
}
