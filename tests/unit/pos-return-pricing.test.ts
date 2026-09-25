import { describe, expect, it } from "vitest";
import { calculatePosReturn } from "@/lib/pos-return-pricing";

const items = [
  { id: 1, quantity: 2, unitPrice: 10_000, netSubtotal: 18_000 },
  { id: 2, quantity: 1, unitPrice: 10_000, netSubtotal: 10_000 },
];

describe("POS return pricing", () => {
  it("allocates item and transaction discounts into refund value", () => {
    const result = calculatePosReturn(items, [], [{ orderItemId: 1, quantity: 1 }], 4_000);
    expect(result.refundAmount).toBe(8_357);
  });

  it("refunds the exact remaining value on the final partial return", () => {
    const previous = [{ orderItemId: 1, quantity: 1, refundAmount: 8_357 }];
    const result = calculatePosReturn(items, previous, [{ orderItemId: 1, quantity: 1 }], 4_000);
    expect(result.refundAmount).toBe(8_357);
  });

  it("rejects returning more than the purchased quantity", () => {
    expect(() => calculatePosReturn(items, [], [{ orderItemId: 2, quantity: 2 }], 4_000))
      .toThrow("melebihi sisa item");
  });
});
