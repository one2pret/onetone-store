import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockDbRows = vi.fn();

function selectChain() {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockImplementation(() => Promise.resolve(mockDbRows()));
  return chain;
}

vi.mock("@/lib/auth", () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(selectChain) } }));

import { canAccessPosSession, requirePosAdmin, requirePosOperator } from "@/lib/pos-auth";

describe("POS authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "2", role: "customer" } });
  });

  it("uses the current database role and accepts an active cashier", async () => {
    mockDbRows.mockReturnValue([{ id: 2, name: "Kasir A", role: "cashier" }]);

    await expect(requirePosOperator()).resolves.toEqual({
      ok: true,
      actor: { id: 2, name: "Kasir A", role: "cashier" },
    });
  });

  it("rejects a session whose database user is missing or deactivated", async () => {
    mockDbRows.mockReturnValue([]);

    await expect(requirePosOperator()).resolves.toEqual({
      ok: false,
      error: "Akses POS ditolak",
    });
  });

  it("does not grant admin reports to a cashier", async () => {
    mockDbRows.mockReturnValue([{ id: 2, name: "Kasir A", role: "cashier" }]);

    await expect(requirePosAdmin()).resolves.toEqual({
      ok: false,
      error: "Hanya admin yang dapat mengakses laporan POS",
    });
  });

  it("keeps cashier sessions isolated while allowing admin oversight", () => {
    expect(canAccessPosSession({ id: 2, name: "A", role: "cashier" }, 2)).toBe(true);
    expect(canAccessPosSession({ id: 2, name: "A", role: "cashier" }, 3)).toBe(false);
    expect(canAccessPosSession({ id: 1, name: "Admin", role: "admin" }, 3)).toBe(true);
  });
});
