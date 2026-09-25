import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();
const mockRequirePosOperator = vi.fn();
const mockDeductStock = vi.fn();
const mockInsertedValues: unknown[] = [];

function mockChain(returnFn: () => unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn((value: unknown) => { mockInsertedValues.push(value); return chain; });
  chain.then = (resolve: (value: unknown) => unknown) => resolve(returnFn());
  return chain;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => mockChain(mockSelectReturn)),
    insert: vi.fn(() => mockChain(mockInsertReturn)),
    query: { products: { findMany: vi.fn() } },
  },
}));

vi.mock("@/lib/pos-auth", () => ({
  requirePosOperator: (...args: unknown[]) => mockRequirePosOperator(...args),
  canAccessPosSession: (actor: { id: number; role: string }, cashierId: number) =>
    actor.role === "admin" || actor.id === cashierId,
}));

vi.mock("@/lib/inventory-stock", () => ({
  validateLocationStock: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
  deductLocationStock: (...args: unknown[]) => mockDeductStock(...args),
  getLocationBalanceMap: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  storage: { getUrl: vi.fn((key: string) => key) },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createPosOrder } from "@/app/actions/pos-orders";

const input = {
  sessionId: 10,
  items: [{ productId: 5, quantity: 1 }],
  paymentMethod: "cash" as const,
  cashReceived: 20_000,
};

describe("POS order authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePosOperator.mockResolvedValue({
      ok: true,
      actor: { id: 2, name: "Kasir A", role: "cashier" },
    });
    mockInsertReturn.mockReturnValue([{ insertId: 99 }]);
    mockDeductStock.mockResolvedValue(undefined);
    mockInsertedValues.length = 0;
  });

  it("snapshots the short POS product and variant labels", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{ id: 5, name: "Nama Produk Online Sangat Panjang", posName: "Produk POS", price: "15000", image: null }])
      .mockReturnValueOnce([{ id: 8, productId: 5, size: "EXTRA LARGE", color: "Midnight Black", posLabel: "XL / Black", priceModifier: "2000" }]);

    const result = await createPosOrder({ ...input, items: [{ productId: 5, variantId: 8, quantity: 1 }] });

    expect(result.success).toBe(true);
    const insertedItems = mockInsertedValues[1] as { productName: string; variantLabel: string }[];
    expect(insertedItems[0]).toMatchObject({ productName: "Produk POS", variantLabel: "XL / Black" });
  });

  it("allows a registered cashier to checkout their own open session", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{
        id: 5,
        name: "Produk Test",
        price: "15000",
        image: null,
      }]);

    const result = await createPosOrder(input);

    expect(result.success).toBe(true);
    expect(mockDeductStock).toHaveBeenCalledOnce();
  });

  it("recalculates and snapshots POS discounts on the server", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{
        id: 5,
        name: "Produk Test",
        price: "15000",
        image: null,
      }]);

    const result = await createPosOrder({
      ...input,
      items: [{
        productId: 5,
        quantity: 1,
        discount: { type: "percent", value: 10 },
      }],
      orderDiscount: { type: "fixed", value: 1_000 },
    });

    expect(result).toMatchObject({
      success: true,
      total: 12_500,
      discountAmount: 2_500,
    });
    expect(mockInsertedValues[0]).toMatchObject({
      subtotal: "15000",
      discountAmount: "2500",
      total: "12500",
    });
    expect((mockInsertedValues[1] as Record<string, unknown>[])[0]).toMatchObject({
      price: "15000",
      productDiscountAmount: "1500",
      subtotal: "13500",
    });
  });

  it("rejects a cashier discount above the 20 percent limit", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{
        id: 5,
        name: "Produk Test",
        price: "15000",
        image: null,
      }]);

    const result = await createPosOrder({
      ...input,
      orderDiscount: { type: "percent", value: 25 },
    });

    expect(result).toEqual({ success: false, error: "Total diskon maksimal 20%" });
    expect(mockInsertedValues).toHaveLength(0);
    expect(mockDeductStock).not.toHaveBeenCalled();
  });

  it("rejects a variant that belongs to another product", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{ id: 5, name: "Produk Test", price: "15000", image: null }])
      .mockReturnValueOnce([{ id: 8, productId: 99, priceModifier: "0" }]);

    const result = await createPosOrder({
      ...input,
      items: [{ productId: 5, variantId: 8, quantity: 1 }],
    });

    expect(result).toEqual({ success: false, error: "Varian ID 8 tidak ditemukan" });
    expect(mockDeductStock).not.toHaveBeenCalled();
  });

  it("rejects checkout through another cashier's session", async () => {
    mockSelectReturn.mockReturnValueOnce([{ id: 10, cashierId: 3, locationId: 7, status: "open" }]);

    const result = await createPosOrder(input);

    expect(result).toEqual({ success: false, error: "Sesi kasir bukan milikmu" });
    expect(mockDeductStock).not.toHaveBeenCalled();
  });

  it("rejects users that are not active POS operators", async () => {
    mockRequirePosOperator.mockResolvedValueOnce({ ok: false, error: "Akses POS ditolak" });

    const result = await createPosOrder(input);

    expect(result).toEqual({ success: false, error: "Akses POS ditolak" });
    expect(mockSelectReturn).not.toHaveBeenCalled();
  });
});
