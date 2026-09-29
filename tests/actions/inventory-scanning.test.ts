import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdmin = vi.fn();
const selectQueue: unknown[] = [];
const insertQueue: unknown[] = [];
const updateQueue: unknown[] = [];
const insertedValues: unknown[] = [];

function chain(queue: unknown[], fallback: unknown = []) {
  const value = queue.length ? queue.shift() : fallback;
  const query: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit", "orderBy", "innerJoin", "leftJoin", "for", "set"]) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  query.values = vi.fn((input: unknown) => { insertedValues.push(input); return query; });
  query.$returningId = vi.fn().mockResolvedValue(value);
  query.then = (resolve: (result: unknown) => unknown) => resolve(value);
  return query;
}

const tx = {
  select: vi.fn(() => chain(selectQueue)),
  insert: vi.fn(() => chain(insertQueue)),
  update: vi.fn(() => chain(updateQueue)),
};

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    select: vi.fn(() => chain(selectQueue)),
    query: { productImages: { findMany: vi.fn().mockResolvedValue([]) } },
  },
}));

vi.mock("@/lib/inventory-auth", () => ({
  requireInventoryAccess: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/storage", () => ({ storage: { getUrl: (key: string) => key } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { receiveInventoryByScan } from "@/app/actions/inventory-scanning";
import { db } from "@/lib/db";

const input = {
  locationId: 3,
  idempotencyKey: "2f7a7ea4-32a8-47ec-899a-b1b1ae128972",
  referenceNumber: "PO-100",
  items: [{ code: "8990001", quantity: 2 }],
};

describe("inventory receipt scanning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    insertQueue.length = 0;
    updateQueue.length = 0;
    insertedValues.length = 0;
    mockRequireAdmin.mockResolvedValue({ ok: true, actor: { id: 1, name: "Admin", role: "admin" }, locationIds: null });
  });

  it("rejects users without inventory admin access", async () => {
    mockRequireAdmin.mockResolvedValueOnce({ ok: false, error: "Hanya admin" });
    expect(await receiveInventoryByScan(input)).toEqual({ success: false, error: "Hanya admin" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns the existing receipt for a repeated idempotency key", async () => {
    selectQueue.push(
      [{ id: 3, isActive: true, isOnlineDefault: false }],
      [{ id: 91, receiptNumber: "RCV-EXISTING" }],
    );
    expect(await receiveInventoryByScan(input)).toMatchObject({
      success: true,
      receiptId: 91,
      receiptNumber: "RCV-EXISTING",
      reused: true,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("atomically adds stock and records a receipt movement", async () => {
    selectQueue.push(
      [{ id: 3, isActive: true, isOnlineDefault: false }],
      [],
      [{ code: "8990001", productId: 10, variantId: null, productActive: true, variantActive: null }],
      [{ id: 44, quantity: 5 }],
    );
    insertQueue.push([{ id: 81 }], []);
    updateQueue.push([]);

    const result = await receiveInventoryByScan(input);

    expect(result).toMatchObject({ success: true, receiptId: 81, reused: false });
    expect(tx.update).toHaveBeenCalledOnce();
    expect(insertedValues[1]).toMatchObject({
      productId: 10,
      quantityDelta: 2,
      balanceAfter: 7,
      type: "receipt",
      referenceType: "inventory_receipt",
      referenceId: 81,
    });
  });
});
