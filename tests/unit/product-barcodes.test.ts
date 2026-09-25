import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue: unknown[] = [];
const mutations = { insert: vi.fn(), update: vi.fn(), delete: vi.fn() };

function chain(value: unknown = []) {
  const query: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit", "set", "values"]) query[method] = vi.fn().mockReturnValue(query);
  query.then = (resolve: (result: unknown) => unknown) => resolve(value);
  return query;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => chain(selectQueue.shift() ?? [])),
    insert: vi.fn(() => { mutations.insert(); return chain(); }),
    update: vi.fn(() => { mutations.update(); return chain(); }),
    delete: vi.fn(() => { mutations.delete(); return chain(); }),
  },
}));

import { setPrimaryBarcode } from "@/lib/product-barcodes";

describe("product barcode registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
  });

  it("creates a globally unique barcode", async () => {
    selectQueue.push([], []);
    await setPrimaryBarcode(7, null, "89910001");
    expect(mutations.insert).toHaveBeenCalledOnce();
  });

  it("rejects a barcode already owned by another sellable item", async () => {
    selectQueue.push([], [{ id: 99 }]);
    await expect(setPrimaryBarcode(7, null, "89910001")).rejects.toThrow("sudah digunakan");
    expect(mutations.insert).not.toHaveBeenCalled();
  });

  it("removes the existing barcode when the field is cleared", async () => {
    selectQueue.push([{ id: 4, code: "89910001" }]);
    await setPrimaryBarcode(7, null, "");
    expect(mutations.delete).toHaveBeenCalledOnce();
  });
});
