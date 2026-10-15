import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { salesEvents } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({ open: vi.fn(), create: vi.fn(), update: vi.fn(), list: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock("@/app/actions/pos-sessions", () => ({ openSession: mocks.open }));
vi.mock("@/app/actions/sales-events", () => ({ createSalesEvent: mocks.create, updateSalesEvent: mocks.update, getSalesEventsAdminData: mocks.list }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toast, error: mocks.toast } }));

import { OpenSessionForm } from "@/components/pos/OpenSessionForm";
import { SalesEventForm } from "@/app/(admin)/dashboard/reports/_components/SalesEventForm";
import SalesEventsPage from "@/app/(admin)/dashboard/reports/events/page";

const locations = [{ id: 7, name: "POS A", code: "POS-A", isActive: true }, { id: 8, name: "POS B", code: "POS-B", isActive: true }];
const event: typeof salesEvents.$inferSelect = { id: 10, code: "BAZAR", name: "Bazar Bandung", status: "active", startsAt: new Date("2026-10-12T02:00:15Z"), endsAt: new Date("2026-10-12T10:00:15Z"),
  venueName: "Bandung", inventoryLocationId: 8, notes: null, createdByUserId: 1, createdAt: new Date(), updatedAt: new Date() };

describe("sales event interfaces", () => {
  beforeEach(() => {
    cleanup();
    vi.resetAllMocks();
    mocks.open.mockResolvedValue({ success: true, sessionId: 1 });
    mocks.create.mockResolvedValue({ success: true, eventId: 10 });
    mocks.update.mockResolvedValue({ success: true, eventId: 10 });
    mocks.list.mockResolvedValue({ events: [], locations, total: 0, page: 1, pageSize: 25 });
  });

  it("defaults to a regular session and works without any event", async () => {
    render(<OpenSessionForm locations={locations} cashierName="Kasir A" />);
    expect(screen.getByLabelText("Sales Event / Bazaar")).toHaveValue("0");
    fireEvent.click(screen.getByRole("button", { name: "Mulai Sesi Kasir" }));
    await waitFor(() => expect(mocks.open).toHaveBeenCalledWith({ locationId: 7, salesEventId: undefined, openingCash: 0, notes: undefined }));
  });

  it("uses the event default stock location but permits an explicit alternative", async () => {
    render(<OpenSessionForm locations={locations} salesEvents={[event]} />);
    fireEvent.change(screen.getByLabelText("Sales Event / Bazaar"), { target: { value: "10" } });
    expect(screen.getByLabelText("Lokasi stok POS")).toHaveValue("8");
    fireEvent.change(screen.getByLabelText("Lokasi stok POS"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Mulai Sesi Kasir" }));
    await waitFor(() => expect(mocks.open).toHaveBeenCalledWith(expect.objectContaining({ locationId: 7, salesEventId: 10 })));
  });

  it("does not silently select an unavailable default location", () => {
    render(<OpenSessionForm locations={locations} salesEvents={[{ ...event, inventoryLocationId: 999 }]} />);
    fireEvent.change(screen.getByLabelText("Sales Event / Bazaar"), { target: { value: "10" } });
    expect(screen.getByLabelText("Lokasi stok POS")).toHaveValue("7");
  });

  it("creates an event and displays actual success feedback", async () => {
    render(<SalesEventForm locations={locations} />);
    fireEvent.change(screen.getByLabelText("Kode event"), { target: { value: "BAZAR" } });
    fireEvent.change(screen.getByLabelText("Nama event"), { target: { value: "Bazar Bandung" } });
    fireEvent.change(screen.getByLabelText("Mulai (WIB)"), { target: { value: "2026-10-12T09:00" } });
    fireEvent.change(screen.getByLabelText("Selesai (WIB)"), { target: { value: "2026-10-12T17:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat event" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ code: "BAZAR", inventoryLocationId: null, status: "draft" })));
    expect(await screen.findByRole("status")).toHaveTextContent("Event dibuat");
  });

  it("freezes used metadata and preserves seconds when submitting a status change", async () => {
    render(<SalesEventForm event={event} used locations={locations} />);
    expect(screen.getByLabelText("Nama event")).toBeDisabled();
    expect(screen.getByLabelText("Mulai (WIB)")).toHaveValue("2026-10-12T09:00:15.000");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "closed" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan event" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(10, expect.objectContaining({ startsAt: "2026-10-12T09:00:15", name: event.name, inventoryLocationId: 8, status: "closed" })));
  });

  it("exposes server errors and prevents editing completed events", async () => {
    mocks.update.mockResolvedValueOnce({ success: false, error: "Tutup semua sesi POS event" });
    render(<SalesEventForm event={event} used locations={locations} />);
    fireEvent.click(screen.getByRole("button", { name: "Simpan event" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tutup semua sesi");
    cleanup();
    render(<SalesEventForm event={{ ...event, status: "closed" }} used locations={locations} />);
    expect(screen.getByLabelText("Status")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Simpan event" })).not.toBeInTheDocument();
  });

  it("shows an honest empty state and real back navigation", async () => {
    render(await SalesEventsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/Belum ada event\. Buat event/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kembali ke laporan" })).toHaveAttribute("href", "/dashboard/reports");
  });

  it("provides server pagination and details for actual event records", async () => {
    mocks.list.mockResolvedValueOnce({ events: [{ event, locationName: "POS B", sessionCount: 2, openSessions: 1 }], locations, total: 26, page: 1, pageSize: 25 });
    render(await SalesEventsPage({ searchParams: Promise.resolve({ page: "1" }) }));
    expect(screen.getByText("2 sesi · 1 aktif")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Berikutnya" })).toHaveAttribute("href", "/dashboard/reports/events?page=2");
    expect(screen.getByText("Kelola detail dan status").closest("details")).toBeInTheDocument();
  });
});
