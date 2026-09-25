export type ReturnableOrderItem = {
  id: number;
  quantity: number;
  unitPrice: number;
  netSubtotal: number;
};

export type PreviousReturn = {
  orderItemId: number;
  quantity: number;
  refundAmount: number;
};

export type RequestedReturn = {
  orderItemId: number;
  quantity: number;
};

export function allocateFinalItemValues(
  items: ReturnableOrderItem[],
  orderDiscountAmount: number,
) {
  const itemDiscountTotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.unitPrice * item.quantity - item.netSubtotal),
    0,
  );
  const transactionDiscount = Math.max(0, orderDiscountAmount - itemDiscountTotal);
  const netItemsTotal = items.reduce((sum, item) => sum + item.netSubtotal, 0);
  let allocated = 0;

  return new Map(items.map((item, index) => {
    const share = index === items.length - 1
      ? transactionDiscount - allocated
      : Math.round(transactionDiscount * (netItemsTotal > 0 ? item.netSubtotal / netItemsTotal : 0));
    allocated += share;
    return [item.id, Math.max(0, item.netSubtotal - share)];
  }));
}

export function calculatePosReturn(
  items: ReturnableOrderItem[],
  previous: PreviousReturn[],
  requested: RequestedReturn[],
  orderDiscountAmount: number,
) {
  const finalValues = allocateFinalItemValues(items, orderDiscountAmount);
  const previousByItem = new Map<number, { quantity: number; refundAmount: number }>();
  for (const row of previous) {
    const current = previousByItem.get(row.orderItemId) ?? { quantity: 0, refundAmount: 0 };
    current.quantity += row.quantity;
    current.refundAmount += row.refundAmount;
    previousByItem.set(row.orderItemId, current);
  }

  const lines = requested.map(request => {
    const item = items.find(candidate => candidate.id === request.orderItemId);
    if (!item || !Number.isInteger(request.quantity) || request.quantity < 1) {
      throw new Error("Item retur tidak valid");
    }
    const returned = previousByItem.get(item.id) ?? { quantity: 0, refundAmount: 0 };
    const remainingQuantity = item.quantity - returned.quantity;
    if (request.quantity > remainingQuantity) throw new Error("Jumlah retur melebihi sisa item");

    const itemFinalValue = finalValues.get(item.id) ?? 0;
    const remainingValue = itemFinalValue - returned.refundAmount;
    const refundAmount = request.quantity === remainingQuantity
      ? remainingValue
      : Math.min(remainingValue, Math.round(itemFinalValue / item.quantity * request.quantity));
    return { orderItemId: item.id, quantity: request.quantity, refundAmount };
  });

  return {
    lines,
    refundAmount: lines.reduce((sum, line) => sum + line.refundAmount, 0),
  };
}
