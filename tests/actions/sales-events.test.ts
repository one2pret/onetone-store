import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), operator: vi.fn(), select: vi.fn(), insert: vi.fn(), update: vi.fn(), lock: vi.fn(), values: vi.fn(), transaction: vi.fn() }));
function chain(resolveValue: () => unknown) {
  const query = {
    from: () => query, where: () => query, limit: () => query, orderBy: () => query, offset: () => query, leftJoin: () => query,
    for: (mode: string) => { mocks.lock(mode); return query; },
    values: (value: unknown) => { mocks.values(value); return query; }, set: (value: unknown) => { mocks.values(value); return query; },
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(resolveValue).then(resolve, reject),
  };
  return query;
}
vi.mock("@/lib/db", () => {
  const db = { select: () => chain(mocks.select), insert: () => chain(mocks.insert), update: () => chain(mocks.update), transaction: mocks.transaction };
  mocks.transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
  return { db };
});
vi.mock("@/lib/pos-auth", () => ({ requirePosAdmin: mocks.admin, requirePosOperator: mocks.operator }));

import { createSalesEvent, getActiveSalesEvents, getSalesEventsAdminData, updateSalesEvent } from "@/app/actions/sales-events";
import { openSession } from "@/app/actions/pos-sessions";
import { salesEventSchema } from "@/lib/sales-events";

const input = { code: "BAZAR", name: "Bazar Bandung", startsAt: "2026-10-12T09:00", endsAt: "2026-10-12T17:00", status: "active" as const, inventoryLocationId: 7 };
const event = { id: 1, ...salesEventSchema.parse(input), venueName: null, notes: null };

describe("sales event authorization and session invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin.mockResolvedValue({ ok: true, actor: { id: 1, role: "admin" } });
    mocks.operator.mockResolvedValue({ ok: true, actor: { id: 2, name: "Kasir A", role: "cashier" } });
    mocks.select.mockReturnValue([]);
    mocks.insert.mockReturnValue([{ insertId: 10 }]);
    mocks.update.mockReturnValue([{ affectedRows: 1 }]);
  });

  it("rejects unauthorized reads and writes before database access", async () => {
    mocks.admin.mockResolvedValue({ ok: false, error: "Forbidden" });
    mocks.operator.mockResolvedValue({ ok: false, error: "Forbidden" });
    expect(await createSalesEvent(input)).toEqual({ success: false, error: "Forbidden" });
    expect(await updateSalesEvent(1, input)).toEqual({ success: false, error: "Forbidden" });
    expect(await getSalesEventsAdminData()).toBeNull();
    expect(await getActiveSalesEvents()).toEqual([]);
    expect(await openSession({ locationId: 7, openingCash: 0 })).toEqual({ success: false, error: "Forbidden" });
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("validates event input and initial status before transaction", async () => {
    expect((await createSalesEvent({ ...input, endsAt: input.startsAt })).success).toBe(false);
    expect((await createSalesEvent({ ...input, status: "closed" })).success).toBe(false);
    expect(await getSalesEventsAdminData(-1)).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("records the authenticated admin, rejects unavailable default locations", async () => {
    expect((await createSalesEvent(input)).success).toBe(false);
    mocks.select.mockReturnValue([{ id: 7 }]);
    expect(await createSalesEvent(input)).toEqual({ success: true, eventId: 10 });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ createdByUserId: 1, startsAt: new Date("2026-10-12T02:00:00Z") }));
  });

  it("handles duplicate codes without leaking database errors", async () => {
    mocks.select.mockReturnValue([{ id: 7 }]);
    mocks.insert.mockImplementation(() => { throw { cause: { code: "ER_DUP_ENTRY" } }; });
    expect(await createSalesEvent(input)).toEqual({ success: false, error: "Kode event sudah digunakan" });
  });

  it("locks an event and prevents changing historical metadata", async () => {
    mocks.select.mockReturnValueOnce([event]).mockReturnValueOnce([{ count: 1, open: 0 }]);
    expect(await updateSalesEvent(1, { ...input, name: "Other event" })).toEqual({ success: false, error: "Detail event terkunci karena sudah dipakai sesi POS" });
    expect(mocks.lock).toHaveBeenCalledWith("update");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(["closed", "cancelled"] as const)("prevents %s with open sessions", async status => {
    mocks.select.mockReturnValueOnce([event]).mockReturnValueOnce([{ count: 1, open: 1 }]);
    expect((await updateSalesEvent(1, { ...input, status })).success).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows completion after sessions close without revalidating old inactive default locations", async () => {
    mocks.select.mockReturnValueOnce([event]).mockReturnValueOnce([{ count: 1, open: 0 }]);
    expect((await updateSalesEvent(1, { ...input, status: "closed" })).success).toBe(true);
    expect(mocks.select).toHaveBeenCalledTimes(2);
  });

  it("rejects reopening or editing terminal events", async () => {
    mocks.select.mockReturnValueOnce([{ ...event, status: "closed" }]);
    expect((await updateSalesEvent(1, input)).success).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("keeps regular sessions nullable and uses the authenticated owner, not client identity", async () => {
    mocks.select.mockReturnValueOnce([{ id: 2, name: "Kasir A" }]).mockReturnValueOnce([{ id: 7 }]).mockReturnValueOnce([]);
    expect(await openSession({ locationId: 7, openingCash: 10000 })).toEqual({ success: true, sessionId: 10 });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ cashierId: 2, assignedCashierName: "Kasir A", salesEventId: null }));
    expect(mocks.lock).toHaveBeenCalledTimes(1);
  });

  it("locks active event attribution when opening a session", async () => {
    mocks.select.mockReturnValueOnce([{ id: 2, name: "Kasir A" }]).mockReturnValueOnce([{ ...event, startsAt: new Date("2001-01-01"), endsAt: new Date("2037-01-01") }])
      .mockReturnValueOnce([{ id: 7 }]).mockReturnValueOnce([]);
    expect((await openSession({ locationId: 7, openingCash: 0, salesEventId: 1 })).success).toBe(true);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ salesEventId: 1 }));
    expect(mocks.lock).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, { ...event, status: "draft" }, { ...event, endsAt: new Date("2001-01-01") }, { ...event, startsAt: new Date("2037-01-01") }])("rejects invalid/stale event choices on the server", async invalidEvent => {
    mocks.select.mockReturnValueOnce([{ id: 2, name: "Kasir A" }]).mockReturnValueOnce(invalidEvent ? [invalidEvent] : []);
    expect((await openSession({ locationId: 7, openingCash: 0, salesEventId: 1 })).success).toBe(false);
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it("prevents another open session and nonfinite cash", async () => {
    mocks.select.mockReturnValueOnce([{ id: 2, name: "Kasir A" }]).mockReturnValueOnce([{ id: 7 }]).mockReturnValueOnce([{ id: 20 }]);
    expect((await openSession({ locationId: 7, openingCash: 0 })).success).toBe(false);
    expect((await openSession({ locationId: 7, openingCash: Infinity })).success).toBe(false);
    expect(mocks.values).not.toHaveBeenCalled();
  });
});
