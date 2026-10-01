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
  sourceType: "external" as const,
  sourceName: "Supplier A",
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
      [{ id: 91, receiptNumber: "RCV-EXISTING", locationId: 3, sourceType: "external", sourceLocationId: null, sourceName: "Supplier A" }],
    );
    expect(await receiveInventoryByScan(input)).toMatchObject({
      success: true,
      receiptId: 91,
      receiptNumber: "RCV-EXISTING",
      reused: true,
    });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("requires a named external source", async () => {
    const result = await receiveInventoryByScan({ ...input, sourceName: "" });
    expect(result.success).toBe(false);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects an internal source without location access", async () => {
    mockRequireAdmin.mockResolvedValueOnce({ ok: true, actor: { id: 1, name: "Staff", role: "inventory_staff" }, locationIds: [3] });
    mockRequireAdmin.mockResolvedValueOnce({ ok: false, error: "Akses ditolak" });
    const result = await receiveInventoryByScan({ ...input, sourceType: "internal", sourceLocationId: 2, sourceName: undefined });
    expect(result).toEqual({ success: false, error: "Anda tidak memiliki akses ke lokasi asal" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects a transfer to the same location", async () => {
    const result = await receiveInventoryByScan({ ...input, sourceType: "internal", sourceLocationId: input.locationId, sourceName: undefined });
    expect(result.success).toBe(false);
    expect(db.transaction).not.toHaveBeenCalled();
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
    expect(insertedValues[0]).toMatchObject({ sourceType: "external", sourceName: "Supplier A", sourceLocationId: null });
  });

  it("records an internal scan as paired transfers without creating receipt stock", async () => {
    selectQueue.push(
      [{ id: 2, isActive: true, isOnlineDefault: false }, { id: 3, isActive: true, isOnlineDefault: false }],
      [],
      [{ code: "8990001", productId: 10, variantId: null, productActive: true, variantActive: null }],
      [{ id: 40, quantity: 8, reserved: 1 }],
      [{ id: 44, quantity: 5 }],
    );
    insertQueue.push([{ id: 82 }], [], []);
    updateQueue.push([{ affectedRows: 1 }], []);

    const result = await receiveInventoryByScan({ ...input, sourceType: "internal", sourceLocationId: 2, sourceName: undefined });

    expect(result).toMatchObject({ success: true, receiptId: 82 });
    expect(insertedValues[1]).toMatchObject({ fromLocationId: 2, toLocationId: 3, receiptId: 82, quantity: 2 });
    expect(insertedValues[2]).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "transfer_out", locationId: 2, quantityDelta: -2 }),
      expect.objectContaining({ type: "transfer_in", locationId: 3, quantityDelta: 2 }),
    ]));
    expect(insertedValues.some(value => !Array.isArray(value) && value && typeof value === "object" && "type" in value && value.type === "receipt")).toBe(false);
  });

  it("rejects an internal transfer when source available stock is insufficient", async () => {
    selectQueue.push(
      [{ id: 2, isActive: true, isOnlineDefault: false }, { id: 3, isActive: true, isOnlineDefault: false }],
      [],
      [{ code: "8990001", productId: 10, variantId: null, productActive: true, variantActive: null }],
      [{ id: 40, quantity: 2, reserved: 1 }],
    );
    insertQueue.push([{ id: 82 }]);

    const result = await receiveInventoryByScan({ ...input, sourceType: "internal", sourceLocationId: 2, sourceName: undefined });

    expect(result).toMatchObject({ success: false });
    if (!result.success) expect(result.error).toContain("tersedia 1");
    expect(tx.update).not.toHaveBeenCalled();
    expect(insertedValues).toHaveLength(1);
  });
});
