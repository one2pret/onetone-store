import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const selectQueue: unknown[] = [];

function chain() {
  const value = selectQueue.shift() ?? [];
  const query: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit"]) query[method] = vi.fn().mockReturnValue(query);
  query.then = (resolve: (result: unknown) => unknown) => resolve(value);
  return query;
}

vi.mock("@/lib/auth", () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(() => chain()) } }));

import { requireInventoryAccess } from "@/lib/inventory-auth";

describe("inventory location authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    mockAuth.mockResolvedValue({ user: { id: "7" } });
  });

  it("allows an admin to access all locations without assignments", async () => {
    selectQueue.push([{ id: 7, name: "Admin", role: "admin" }]);
    expect(await requireInventoryAccess(99)).toEqual({
      ok: true,
      actor: { id: 7, name: "Admin", role: "admin" },
      locationIds: null,
    });
  });

  it("allows inventory staff only at assigned locations", async () => {
    selectQueue.push(
      [{ id: 7, name: "Rina", role: "inventory_staff" }],
      [{ locationId: 2 }, { locationId: 4 }],
    );
    expect(await requireInventoryAccess(4)).toMatchObject({ ok: true, locationIds: [2, 4] });
  });

  it("rejects inventory staff at an unassigned location", async () => {
    selectQueue.push(
      [{ id: 7, name: "Rina", role: "inventory_staff" }],
      [{ locationId: 2 }],
    );
    expect(await requireInventoryAccess(4)).toEqual({ ok: false, error: "Anda tidak memiliki akses ke lokasi inventori ini" });
  });

  it("rejects cashier accounts", async () => {
    selectQueue.push([{ id: 7, name: "Kasir", role: "cashier" }]);
    expect(await requireInventoryAccess()).toEqual({ ok: false, error: "Akses inventori ditolak" });
  });
});
