import { describe, expect, it } from "vitest";
import { calculatePosDiscountPricing } from "@/lib/pos-discounts";

const lines = [
  { key: "1", unitPrice: 10_000, quantity: 2 },
  { key: "2", unitPrice: 5_000, quantity: 1 },
];

describe("POS discount pricing", () => {
  it("calculates item and transaction discounts", () => {
    const result = calculatePosDiscountPricing([
      { ...lines[0], discount: { type: "percent", value: 10 } },
      lines[1],
    ], { type: "fixed", value: 2_000 }, 20);

    expect(result).toMatchObject({
      subtotal: 25_000,
      itemDiscountTotal: 2_000,
      orderDiscountAmount: 2_000,
      discountTotal: 4_000,
      total: 21_000,
    });
    expect(result.lineDiscounts.get("1")).toBe(2_000);
  });

  it("rejects combined discounts above the operator limit", () => {
    expect(() => calculatePosDiscountPricing([
      { ...lines[0], discount: { type: "percent", value: 20 } },
      lines[1],
    ], { type: "fixed", value: 2_000 }, 20)).toThrow("maksimal 20%");
  });

  it("rejects a fixed item discount above the line value", () => {
    expect(() => calculatePosDiscountPricing([
      { ...lines[0], discount: { type: "fixed", value: 30_000 } },
    ], undefined, 100)).toThrow("melebihi nilai item");
  });

  it("allows an admin to discount the full transaction", () => {
    const result = calculatePosDiscountPricing(lines, { type: "percent", value: 100 }, 100);
    expect(result.total).toBe(0);
  });

  it("counts automatic promotions toward the cashier limit", () => {
    const result = calculatePosDiscountPricing([
      { key: "promo", regularUnitPrice: 10_000, unitPrice: 9_000, quantity: 1 },
    ], { type: "fixed", value: 1_000 }, 20);

    expect(result).toMatchObject({
      regularSubtotal: 10_000,
      subtotal: 9_000,
      automaticDiscountTotal: 1_000,
      discountTotal: 1_000,
      total: 8_000,
    });
  });

  it("allows an admin-configured promo above the cashier limit but blocks extra manual discount", () => {
    const promoLine = [{ key: "promo", regularUnitPrice: 10_000, unitPrice: 7_000, quantity: 1 }];
    expect(calculatePosDiscountPricing(promoLine, undefined, 20).total).toBe(7_000);
    expect(() => calculatePosDiscountPricing(
      promoLine,
      { type: "fixed", value: 1 },
      20,
    )).toThrow("maksimal 20%");
  });
});
