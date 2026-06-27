// lib/order-status.ts

export const ORDER_STATUSES = [
  'waiting_payment',
  'packing',
  'shipping',
  'delivered',
  'expired',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  waiting_payment: ['packing', 'expired', 'cancelled'],
  packing: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [], // terminal
  expired: ['waiting_payment'], // repayment
  cancelled: [], // terminal
};

export function validateStatusTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from as OrderStatus];
  if (!allowed) return false;
  return allowed.includes(to as OrderStatus);
}

export function getNextStatuses(status: string): string[] {
  return VALID_TRANSITIONS[status as OrderStatus] ?? [];
}
