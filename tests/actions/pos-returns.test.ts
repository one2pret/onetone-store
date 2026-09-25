import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue: unknown[] = [];
const insertedValues: unknown[] = [];
const mockRequirePosAdmin = vi.fn();
const mockRevalidatePath = vi.fn();

function chain(value: unknown = []) {
  const query: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit", "innerJoin", "leftJoin", "orderBy", "groupBy", "set"]) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  query.values = vi.fn((values: unknown) => {
    insertedValues.push(values);
    return query;
  });
  query.$returningId = vi.fn().mockResolvedValue([{ id: 77 }]);
  query.then = (resolve: (result: unknown) => unknown) => resolve(value);
  return query;
}

const tx = {
  execute: vi.fn().mockResolvedValue([]),
  select: vi.fn(() => chain(selectQueue.shift() ?? [])),
  insert: vi.fn(() => chain()),
  update: vi.fn(() => chain()),
};

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    select: vi.fn(() => chain()),
  },
}));

vi.mock("@/lib/pos-auth", () => ({
  requirePosAdmin: (...args: unknown[]) => mockRequirePosAdmin(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args) }));

import { createPosReturn } from "@/app/actions/pos-returns";

describe("POS return action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    insertedValues.length = 0;
    mockRequirePosAdmin.mockResolvedValue({ ok: true, actor: { id: 1, name: "Admin", role: "admin" } });
  });

  it("rejects non-admin operators", async () => {
    mockRequirePosAdmin.mockResolvedValueOnce({ ok: false, error: "Hanya admin" });
    expect(await createPosReturn({
      orderId: 1,
      items: [{ orderItemId: 2, quantity: 1, restock: true }],
      refundMethod: "transfer",
      reason: "Barang rusak",
    })).toEqual({ success: false, error: "Hanya admin" });
  });

  it("creates an audited partial refund and stock return", async () => {
    selectQueue.push(
      [{ id: 10, channel: "pos", status: "delivered", discountAmount: "1000", locationId: 3 }],
      [{ id: 20, orderId: 10, productId: 5, variantId: null, quantity: 1, price: "10000", subtotal: "9000" }],
      [],
      [],
    );

    const result = await createPosReturn({
      orderId: 10,
      items: [{ orderItemId: 20, quantity: 1, restock: true }],
      refundMethod: "transfer",
      reason: "Barang rusak saat diterima",
    });

    expect(result).toMatchObject({ success: true, returnId: 77, refundAmount: 9000 });
    expect(insertedValues[0]).toMatchObject({ orderId: 10, actorUserId: 1, refundAmount: "9000" });
    expect(insertedValues[1]).toMatchObject({ returnId: 77, orderItemId: 20, quantity: 1, restocked: true });
    expect(insertedValues[3]).toMatchObject({ type: "return", referenceType: "pos_return", referenceId: 77 });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/inventory");
  });

  it("rolls back when the item has already been fully returned", async () => {
    selectQueue.push(
      [{ id: 10, channel: "pos", status: "delivered", discountAmount: "0", locationId: 3 }],
      [{ id: 20, orderId: 10, productId: 5, variantId: null, quantity: 1, price: "10000", subtotal: "10000" }],
      [{ orderItemId: 20, quantity: 1, refundAmount: "10000" }],
    );

    const result = await createPosReturn({
      orderId: 10,
      items: [{ orderItemId: 20, quantity: 1, restock: false }],
      refundMethod: "transfer",
      reason: "Percobaan retur ulang",
    });

    expect(result).toEqual({ success: false, error: "Jumlah retur melebihi sisa item" });
    expect(insertedValues).toHaveLength(0);
  });
});
