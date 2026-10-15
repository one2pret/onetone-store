import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), select: vi.fn(), execute: vi.fn() }));

vi.mock("@/lib/pos-auth", () => ({ requirePosAdmin: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { transaction: mocks.transaction } }));

import { getCashierSalesReport } from "@/app/actions/pos-reports";

function selectChain(rows: unknown[]) {
  const query = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockResolvedValue(rows);
  query.limit.mockResolvedValue(rows);
  return query;
}

describe("cashier sales report action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ ok: true, actor: { id: 1, role: "admin", name: "Admin" } });
    mocks.select
      .mockReturnValueOnce(selectChain([{ id: 2, name: "Kasir", deletedAt: null }]))
      .mockReturnValueOnce(selectChain([{ id: 7, name: "Lokasi POS", code: "POS-1", isActive: true }]));
    mocks.execute
      .mockResolvedValueOnce([[{ rowKind: "summary", totalCashiers: "1", transactions: "1", salesBeforeRefunds: "500000", netSales: "400000", refunds: "100000" },
        { rowKind: "cashier", cashierId: 2, cashierName: "Kasir", inactive: "0", transactions: "1", salesBeforeRefunds: "500000", netSales: "400000", refunds: "100000" }], []])
      .mockResolvedValueOnce([[{ missingSessionOrders: "0" }], []]);
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({ select: mocks.select, execute: mocks.execute }));
  });

  it.each(["customer", "cashier", "inventory_staff", "deactivated admin"])("denies %s before querying reporting data", async role => {
    mocks.auth.mockResolvedValueOnce({ ok: false, error: `Akses ditolak: ${role}` });
    expect(await getCashierSalesReport()).toMatchObject({ success: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid filters without querying data", async () => {
    expect(await getCashierSalesReport({ from: "2026-02-30" })).toMatchObject({ success: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns aggregate data in a read-only consistent snapshot", async () => {
    const result = await getCashierSalesReport({ from: "2026-10-01", to: "2026-10-01", cashierId: 2, locationId: 7 });
    expect(result).toMatchObject({ success: true, data: { totalCashiers: 1,
      summary: { transactions: 1, netSales: 400000, refunds: 100000, averageTransaction: 500000 },
      rows: [{ cashierId: 2, cashierName: "Kasir", inactive: false, netSales: 400000 }],
    } });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "repeatable read", accessMode: "read only" });
  });

  it("rejects an unknown cashier instead of silently broadening the filter", async () => {
    expect(await getCashierSalesReport({ cashierId: 99 })).toMatchObject({ success: false, error: "Kasir pada filter tidak ditemukan" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("rejects an unknown location instead of silently broadening the filter", async () => {
    expect(await getCashierSalesReport({ locationId: 99 })).toMatchObject({ success: false, error: "Lokasi pada filter tidak ditemukan" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("preserves a validated event filter for cashier drill-down and pagination", async () => {
    mocks.select.mockReturnValueOnce(selectChain([{ id: 5 }]));
    expect(await getCashierSalesReport({ eventId: 5 })).toMatchObject({ success: true, data: { filters: { eventId: 5 } } });
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it("rejects an unknown event instead of returning all cashiers", async () => {
    mocks.select.mockReturnValueOnce(selectChain([]));
    expect(await getCashierSalesReport({ eventId: 99 })).toMatchObject({ success: false, error: "Event pada filter tidak ditemukan" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
