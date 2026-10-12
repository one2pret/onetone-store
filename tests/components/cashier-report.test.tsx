import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readCashierMetrics } from "@/lib/pos-reporting";

const mocks = vi.hoisted(() => ({ report: vi.fn(), auth: vi.fn() }));
vi.mock("@/app/actions/pos-reports", () => ({ getCashierSalesReport: mocks.report }));
vi.mock("@/lib/pos-auth", () => ({ requirePosAdmin: mocks.auth }));

import CashierReportPage from "@/app/(admin)/dashboard/reports/cashiers/page";
import ReportsLayout from "@/app/(admin)/dashboard/reports/layout";
import ReportsError from "@/app/(admin)/dashboard/reports/error";
import ReportsLoading from "@/app/(admin)/dashboard/reports/loading";

function reportData() {
  const metrics = readCashierMetrics({ transactions: 1, grossSales: 500000, salesBeforeRefunds: 500000, netSales: 400000,
    refunds: 100000, itemsSold: 5, returnedItems: 1, netItems: 4, cashSales: 500000, transferRefunds: 100000 });
  return {
    filters: { from: "2026-10-01", to: "2026-10-31", page: 1 }, asOf: "2026-11-02T00:00:00Z",
    summary: metrics, rows: [{ ...metrics, cashierId: 2, cashierName: "Kasir A", inactive: false }],
    cashiers: [{ id: 2, name: "Kasir A", inactive: false }], locations: [{ id: 7, name: "POS Bandung", code: "POS-BDG", isActive: true }],
    quality: { missingSessionOrders: 0, missingPaymentDateOrders: 0, unexpectedStatusOrders: 0, missingLocationOrders: 0 },
    pageSize: 25, totalCashiers: 1,
  };
}

describe("cashier reporting screens", () => {
  beforeEach(() => {
    cleanup();
    vi.resetAllMocks();
    mocks.report.mockResolvedValue({ success: true, data: reportData() });
    mocks.auth.mockResolvedValue({ ok: true, actor: { id: 1, role: "admin" } });
  });

  it("submits real GET filters and provides a cashier drill-down preserving the date range", async () => {
    render(await CashierReportPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByLabelText("Mulai (WIB)")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Sampai (WIB)")).toHaveValue("2026-10-31");
    const submit = screen.getByRole("button", { name: "Tampilkan laporan" });
    expect(submit.closest("form")).toHaveAttribute("method", "get");
    expect(submit.closest("form")).toHaveAttribute("action", "/dashboard/reports/cashiers");
    expect(screen.getAllByRole("link", { name: "Kasir A" })[0]).toHaveAttribute("href", "/dashboard/reports/cashiers?from=2026-10-01&to=2026-10-31&page=1&cashierId=2");
    expect(screen.getByText(/Refund mengikuti order penjualan asal/)).toBeInTheDocument();
    expect(screen.getByText(/Sesi aktif tidak dianggap berselisih nol/)).toBeInTheDocument();
  });

  it("distinguishes an empty report from an error and explains how to adjust filters", async () => {
    mocks.report.mockResolvedValueOnce({ success: true, data: { ...reportData(), rows: [], totalCashiers: 0, summary: readCashierMetrics({}) } });
    render(await CashierReportPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/Belum ada penjualan atau sesi ditutup yang cocok/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not claim zero cash difference when no session has closed", async () => {
    render(await CashierReportPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getAllByText("Belum ada sesi ditutup")).toHaveLength(2);
  });

  it("keeps incomplete legacy data visible with a specific explanation", async () => {
    const data = reportData();
    data.summary.legacyPriceOrders = 1;
    mocks.report.mockResolvedValueOnce({ success: true, data });
    render(await CashierReportPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/snapshot harga lama/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Data yang perlu diperiksa" })).toBeInTheDocument();
  });

  it("shows a recoverable invalid-filter error", async () => {
    mocks.report.mockResolvedValueOnce({ success: false, error: "Tanggal tidak valid" });
    render(await CashierReportPage({ searchParams: Promise.resolve({ from: "wrong" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tanggal tidak valid");
    expect(screen.getByRole("link", { name: "Gunakan filter awal" })).toHaveAttribute("href", "/dashboard/reports/cashiers");
  });

  it("rejects repeated query parameters instead of broadening the selected cashier", async () => {
    render(await CashierReportPage({ searchParams: Promise.resolve({ cashierId: ["2", "3"] }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Gunakan satu nilai untuk setiap filter laporan");
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("requires database-verified admin access at the route boundary", async () => {
    mocks.auth.mockResolvedValueOnce({ ok: false, error: "Akses ditolak" });
    await expect(ReportsLayout({ children: "Private report" })).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("exposes a loading status and a working retry action", () => {
    const reset = vi.fn();
    render(<><ReportsLoading /><ReportsError reset={reset} /></>);
    expect(screen.getByRole("status")).toHaveTextContent("Menghitung penjualan");
    fireEvent.click(screen.getByRole("button", { name: "Muat ulang laporan" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
