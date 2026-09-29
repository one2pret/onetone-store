import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();
const mockRequirePosOperator = vi.fn();
const mockDeductStock = vi.fn();
const mockAwardPosOrderPoints = vi.fn();
const mockProductImages = vi.fn();
const mockPosProducts = vi.fn();
const mockGetLocationBalanceMap = vi.fn();
const mockInsertedValues: unknown[] = [];

function mockChain(returnFn: () => unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
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
    query: {
      products: { findMany: (...args: unknown[]) => mockPosProducts(...args) },
      productImages: { findMany: (...args: unknown[]) => mockProductImages(...args) },
    },
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
  getLocationBalanceMap: (...args: unknown[]) => mockGetLocationBalanceMap(...args),
}));

vi.mock("@/lib/storage", () => ({
  storage: { getUrl: vi.fn((key: string) => key) },
}));

vi.mock("@/lib/pos-membership-points", () => ({
  awardPosOrderPoints: (...args: unknown[]) => mockAwardPosOrderPoints(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createPosOrder, getPosProducts } from "@/app/actions/pos-orders";

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
    mockAwardPosOrderPoints.mockResolvedValue({ awarded: true, pointsEarned: 2 });
    mockProductImages.mockResolvedValue([]);
    mockPosProducts.mockResolvedValue([]);
    mockGetLocationBalanceMap.mockResolvedValue(new Map());
    mockInsertedValues.length = 0;
  });

  it("snapshots the short POS product and variant labels", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{ id: 5, name: "Nama Produk Online Sangat Panjang", posName: "Produk POS", price: "15000", image: null }])
      .mockReturnValueOnce([{ id: 8, productId: 5, size: "EXTRA LARGE", color: "Midnight Black", posLabel: "XL / Black", priceModifier: "2000" }]);

    const result = await createPosOrder({
      ...input,
      cashReceived: 120_000,
      items: [{ productId: 5, variantId: 8, quantity: 1 }],
    });

    expect(result.success).toBe(true);
    const insertedItems = mockInsertedValues[1] as { productName: string; variantLabel: string }[];
    expect(insertedItems[0]).toMatchObject({ productName: "Produk POS", variantLabel: "XL / Black" });
  });

  it("snapshots the exact selected variant image", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{ id: 5, name: "Bolero", posName: null, price: "110000", image: "/product.webp" }])
      .mockReturnValueOnce([{ id: 8, productId: 5, size: "M", color: "Black", posLabel: null, priceModifier: "0" }]);
    mockProductImages.mockResolvedValue([
      { id: 1, variantId: null, variantColor: null, isPrimary: true, sortOrder: 0, objectKey: "product.webp", objectKeyThumb: "product-thumb.webp" },
      { id: 2, variantId: 8, variantColor: null, isPrimary: false, sortOrder: 1, objectKey: "m-black.webp", objectKeyThumb: "m-black-thumb.webp" },
    ]);

    const result = await createPosOrder({
      ...input,
      cashReceived: 120_000,
      items: [{ productId: 5, variantId: 8, quantity: 1 }],
    });

    expect(result.success).toBe(true);
    const insertedItems = mockInsertedValues[1] as { productImage: string | null }[];
    expect(insertedItems[0].productImage).toBe("m-black-thumb.webp");
  });

  it("returns exact and legacy fallback image URLs for POS variants", async () => {
    mockGetLocationBalanceMap.mockResolvedValue(new Map([
      ["5:8", 3],
      ["5:9", 2],
    ]));
    mockPosProducts.mockResolvedValue([{
      id: 5,
      name: "Bolero",
      posName: null,
      slug: "bolero",
      price: "110000",
      stock: 0,
      image: "/product.webp",
      category: null,
      barcodes: [],
      variants: [
        { id: 8, productId: 5, size: "M", color: "Black", priceModifier: "0", isActive: true, sku: null, posLabel: null, barcodes: [] },
        { id: 9, productId: 5, size: "S", color: "Olive", priceModifier: "0", isActive: true, sku: null, posLabel: null, barcodes: [] },
      ],
      images: [
        { id: 1, variantId: null, variantColor: null, isPrimary: true, sortOrder: 0, objectKey: "product.webp", objectKeyThumb: "product-thumb.webp" },
        { id: 2, variantId: 8, variantColor: null, isPrimary: false, sortOrder: 1, objectKey: "m-black.webp", objectKeyThumb: "m-black-thumb.webp" },
        { id: 3, variantId: null, variantColor: "Olive", isPrimary: false, sortOrder: 2, objectKey: "olive.webp", objectKeyThumb: "olive-thumb.webp" },
      ],
    }]);

    const result = await getPosProducts(7);

    expect(result[0].image).toBe("product-thumb.webp");
    expect(result[0]).not.toHaveProperty("images");
    expect(result[0].variants).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 8, image: "m-black-thumb.webp", stock: 3 }),
      expect.objectContaining({ id: 9, image: "olive-thumb.webp", stock: 2 }),
    ]));
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

  it("links a validated member to the POS order", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{ id: 41, name: "Rina Member" }])
      .mockReturnValueOnce([{
        id: 5,
        name: "Produk Test",
        price: "15000",
        image: null,
      }]);

    const result = await createPosOrder({ ...input, customerUserId: 41 });

    expect(result.success).toBe(true);
    expect(mockInsertedValues[0]).toMatchObject({
      userId: 41,
      shippingName: "Rina Member",
    });
    expect(mockAwardPosOrderPoints).toHaveBeenCalledWith(99, 41);
    expect(result).toMatchObject({ pointsEarned: 2 });
  });

  it("rejects an unknown or inactive member", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([]);

    const result = await createPosOrder({ ...input, customerUserId: 999 });

    expect(result).toEqual({ success: false, error: "Member tidak ditemukan atau tidak aktif" });
    expect(mockInsertedValues).toHaveLength(0);
    expect(mockDeductStock).not.toHaveBeenCalled();
  });

  it("links a pending POS customer lead to the order", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{ id: 71, name: "Calon Member" }])
      .mockReturnValueOnce([{
        id: 5,
        name: "Produk Test",
        price: "15000",
        image: null,
      }]);

    const result = await createPosOrder({ ...input, customerLeadId: 71 });

    expect(result.success).toBe(true);
    expect(mockInsertedValues[0]).toMatchObject({
      userId: null,
      posCustomerLeadId: 71,
      shippingName: "Calon Member",
    });
  });

  it("rejects an unavailable POS customer lead", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([]);

    const result = await createPosOrder({ ...input, customerLeadId: 999 });

    expect(result).toEqual({ success: false, error: "Calon member tidak ditemukan atau sudah diaktivasi" });
    expect(mockInsertedValues).toHaveLength(0);
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
      productDiscountAmount: "0",
      manualDiscountAmount: "1500",
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

  it("recalculates an active POS promotion on the server and snapshots it separately", async () => {
    mockSelectReturn
      .mockReturnValueOnce([{ id: 10, cashierId: 2, locationId: 7, status: "open" }])
      .mockReturnValueOnce([{
        id: 5,
        name: "Produk Promo POS",
        price: "100000",
        salePrice: "85000",
        saleStartsAt: null,
        saleEndsAt: null,
        saleChannel: "pos",
        image: null,
      }]);

    const result = await createPosOrder({ ...input, cashReceived: 100_000 });

    expect(result).toMatchObject({ success: true, total: 85_000, discountAmount: 0 });
    expect(mockInsertedValues[0]).toMatchObject({ subtotal: "85000", total: "85000" });
    expect((mockInsertedValues[1] as Record<string, unknown>[])[0]).toMatchObject({
      price: "85000",
      regularPrice: "100000",
      productDiscountAmount: "15000",
      manualDiscountAmount: "0",
      subtotal: "85000",
    });
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
