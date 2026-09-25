export type PosDiscount = {
  type: "percent" | "fixed";
  value: number;
};

export type PosDiscountLine = {
  key: string;
  unitPrice: number;
  quantity: number;
  discount?: PosDiscount;
};

export type PosDiscountPricing = {
  subtotal: number;
  itemDiscountTotal: number;
  orderDiscountAmount: number;
  discountTotal: number;
  total: number;
  lineDiscounts: Map<string, number>;
};

function roundRupiah(value: number) {
  return Math.round(value);
}

function requestedDiscount(base: number, discount?: PosDiscount) {
  if (!discount || discount.value <= 0) return 0;
  if (!Number.isFinite(discount.value)) throw new Error("Nilai diskon tidak valid");
  if (discount.type === "percent") {
    if (discount.value > 100) throw new Error("Diskon persen maksimal 100%");
    return roundRupiah(base * discount.value / 100);
  }
  return roundRupiah(discount.value);
}

export function calculatePosDiscountPricing(
  lines: PosDiscountLine[],
  orderDiscount: PosDiscount | undefined,
  maxTotalPercent: number,
): PosDiscountPricing {
  if (!Number.isFinite(maxTotalPercent) || maxTotalPercent < 0 || maxTotalPercent > 100) {
    throw new Error("Batas diskon tidak valid");
  }

  let subtotal = 0;
  let itemDiscountTotal = 0;
  const lineDiscounts = new Map<string, number>();

  for (const line of lines) {
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0 || !Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error("Item diskon tidak valid");
    }
    const lineSubtotal = roundRupiah(line.unitPrice * line.quantity);
    const discountAmount = requestedDiscount(lineSubtotal, line.discount);
    if (discountAmount > lineSubtotal) throw new Error("Diskon item melebihi nilai item");
    subtotal += lineSubtotal;
    itemDiscountTotal += discountAmount;
    lineDiscounts.set(line.key, discountAmount);
  }

  const maximumDiscount = roundRupiah(subtotal * maxTotalPercent / 100);
  if (itemDiscountTotal > maximumDiscount) {
    throw new Error(`Total diskon maksimal ${maxTotalPercent}%`);
  }

  const afterItemDiscount = subtotal - itemDiscountTotal;
  const orderDiscountAmount = requestedDiscount(afterItemDiscount, orderDiscount);
  if (itemDiscountTotal + orderDiscountAmount > maximumDiscount) {
    throw new Error(`Total diskon maksimal ${maxTotalPercent}%`);
  }

  const discountTotal = itemDiscountTotal + orderDiscountAmount;
  return {
    subtotal,
    itemDiscountTotal,
    orderDiscountAmount,
    discountTotal,
    total: subtotal - discountTotal,
    lineDiscounts,
  };
}
