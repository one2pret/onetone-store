import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdmin = vi.fn();
const selectQueue: unknown[] = [];
const updateQueue: unknown[] = [];
const insertQueue: unknown[] = [];

function chain(queue: unknown[], fallback: unknown = []) {
  const value = queue.length ? queue.shift() : fallback;
  const query: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit", "orderBy", "leftJoin", "set", "values"]) query[method] = vi.fn().mockReturnValue(query);
  query.$returningId = vi.fn().mockResolvedValue(value);
  query.then = (resolve: (result: unknown) => unknown) => resolve(value);
  return query;
}

const tx = {
  select: vi.fn(() => chain(selectQueue)),
  update: vi.fn(() => chain(updateQueue)),
  insert: vi.fn(() => chain(insertQueue)),
};

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    select: vi.fn(() => chain(selectQueue)),
    update: vi.fn(() => chain(updateQueue)),
    insert: vi.fn(() => chain(insertQueue)),
  },
}));

vi.mock("@/lib/pos-auth", () => ({
  requirePosAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  requirePosOperator: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { transferInventory } from "@/app/actions/inventory";
import { db } from "@/lib/db";

const input = { fromLocationId: 1, toLocationId: 2, productId: 10, variantId: null, quantity: 3, notes: "Restock cabang" };

describe("inventory transfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    updateQueue.length = 0;
    insertQueue.length = 0;
    mockRequireAdmin.mockResolvedValue({ ok: true, actor: { id: 1, name: "Admin", role: "admin" } });
  });

  it("rejects transfers between the same location before opening a transaction", async () => {
    const result = await transferInventory({ ...input, toLocationId: 1 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("berbeda");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects a quantity larger than available source stock", async () => {
    selectQueue.push(
      [{ id: 1, name: "Online", isOnlineDefault: true }, { id: 2, name: "POS", isOnlineDefault: false }],
      [{ id: 11, quantity: 2, reserved: 0 }],
    );
    const result = await transferInventory(input);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Tersedia 2");
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("atomically creates paired movements for a successful transfer", async () => {
    selectQueue.push(
      [{ id: 1, name: "Gudang Online", isOnlineDefault: true }, { id: 2, name: "POS Cimahi", isOnlineDefault: false }],
      [{ id: 11, quantity: 10, reserved: 1 }],
      [{ id: 22, quantity: 4, reserved: 0 }],
    );
    updateQueue.push([{ affectedRows: 1 }], [], []);
    insertQueue.push([{ id: 77 }], []);

    const result = await transferInventory(input);

    expect(result).toEqual({ success: true, transferId: 77 });
    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(tx.update).toHaveBeenCalledTimes(3);
  });
});
