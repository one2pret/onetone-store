import { z } from "zod";

export const CASHIER_REPORT_PAGE_SIZE = 25;
const DAY_MS = 86_400_000;

export function jakartaDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}

const reportDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid").refine(value => {
  const parsed = new Date(`${value}T00:00:00+07:00`);
  return Number.isFinite(parsed.getTime()) && jakartaDateKey(parsed) === value
    && value >= "2000-01-01" && value <= "2100-12-31";
}, "Tanggal tidak valid");

const optionalId = z.preprocess(
  value => value === "" || value === undefined || value === null ? undefined : value,
  z.coerce.number().int().positive("Pilihan filter tidak valid").max(2_147_483_647).optional(),
);

export type CashierReportInput = {
  from?: string;
  to?: string;
  cashierId?: string | number;
  locationId?: string | number;
  page?: string | number;
};

export function parseCashierReportFilters(input: CashierReportInput, now = new Date()) {
  const parsed = z.object({
    from: reportDate.default(jakartaDateKey(new Date(now.getTime() - 29 * DAY_MS))),
    to: reportDate.default(jakartaDateKey(now)),
    cashierId: optionalId,
    locationId: optionalId,
    page: z.preprocess(value => value === "" || value === undefined ? 1 : value,
      z.coerce.number().int().min(1).max(10_000)),
  }).safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Filter tidak valid" } as const;

  const start = new Date(`${parsed.data.from}T00:00:00+07:00`);
  const end = new Date(new Date(`${parsed.data.to}T00:00:00+07:00`).getTime() + DAY_MS);
  if (start >= end) return { success: false, error: "Tanggal mulai harus sebelum atau sama dengan tanggal akhir" } as const;
  if (end.getTime() - start.getTime() > 366 * DAY_MS) {
    return { success: false, error: "Rentang laporan maksimal 366 hari" } as const;
  }

  return { success: true, filters: { ...parsed.data, start, end, asOf: now } } as const;
}

export type CashierReportFilters = Extract<ReturnType<typeof parseCashierReportFilters>, { success: true }>["filters"];

export const CASHIER_METRICS = [
  "transactions", "subtotal", "grossSales", "automaticDiscounts", "additionalDiscounts", "totalDiscounts",
  "salesBeforeRefunds", "refunds", "netSales", "itemsSold", "returnedItems", "netItems",
  "salesSessionCount", "closedSessionCount", "cashDifference", "cashDifferenceMissing",
  "legacyPriceOrders", "missingItemOrders", "cashSales", "qrisSales", "transferSales", "unknownPaymentSales",
  "cashRefunds", "qrisRefunds", "transferRefunds",
] as const;

export type CashierReportMetrics = Record<typeof CASHIER_METRICS[number], number> & { averageTransaction: number };
export type CashierReportRow = CashierReportMetrics & {
  cashierId: number;
  cashierName: string;
  inactive: boolean;
};

export function readCashierMetrics(row: Record<string, unknown>): CashierReportMetrics {
  const metrics = Object.fromEntries(CASHIER_METRICS.map(key => [key, Number(row[key] ?? 0)])) as Record<typeof CASHIER_METRICS[number], number>;
  return { ...metrics, averageTransaction: metrics.transactions ? metrics.salesBeforeRefunds / metrics.transactions : 0 };
}
