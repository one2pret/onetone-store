import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export function validCallbackToken(received: string | null, configured?: string): boolean {
  if (!received || !configured) return false;
  const first = Buffer.from(received, 'utf8');
  const second = Buffer.from(configured, 'utf8');
  return first.length === second.length && timingSafeEqual(first, second);
}

const rawCallback = z.object({
  id: z.string().trim().min(1).max(255),
  external_id: z.string().trim().min(1).max(50),
  status: z.string().trim().min(1).max(32),
  amount: z.number().int().positive(),
  paid_amount: z.number().int().nonnegative().nullish(),
  currency: z.string().trim().max(8).nullish(),
  payment_method: z.string().max(100).nullish(),
  payment_channel: z.string().max(100).nullish(),
});

export type SandboxInvoiceEvent = {
  id: string;
  orderNumber: string;
  status: 'PAID' | 'EXPIRED';
  amount: number;
  paidAmount: number | null;
  paymentMethod: string | null;
  paymentChannel: string | null;
};

/** Legacy invoice callback format. New Xendit payment.capture events use
 * another contract and must never be interpreted as invoice callbacks. */
export function parseSandboxInvoiceEvent(
  input: unknown,
): { kind: 'event'; event: SandboxInvoiceEvent }
  | { kind: 'ignored' }
  | { kind: 'invalid' } {
  const parsed = rawCallback.safeParse(input);
  if (!parsed.success) return { kind: 'invalid' };
  const value = parsed.data;
  if (value.status !== 'PAID' && value.status !== 'EXPIRED') {
    return { kind: 'ignored' };
  }
  if (!/^SBX-[a-f0-9]{36}$/.test(value.external_id)) return { kind: 'invalid' };
  if (value.currency && value.currency !== 'IDR') return { kind: 'invalid' };
  if (value.status === 'PAID' && value.paid_amount !== null &&
      value.paid_amount !== undefined && value.paid_amount !== value.amount) {
    return { kind: 'invalid' };
  }
  return { kind: 'event', event: {
    id: value.id,
    orderNumber: value.external_id,
    status: value.status,
    amount: value.amount,
    paidAmount: value.paid_amount ?? null,
    paymentMethod: value.payment_method ?? null,
    paymentChannel: value.payment_channel ?? null,
  } };
}

export type InvoiceStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | null;
export type OrderStatus = 'waiting_payment' | 'packing' | 'shipping' | 'delivered' | 'expired' | 'cancelled' | null;
export type PaymentDecision = 'pay' | 'expire' | 'duplicate' | 'conflict';

/** Terminal statuses cannot be reversed by delayed Xendit callbacks. */
export function sandboxPaymentDecision(
  event: 'PAID' | 'EXPIRED',
  invoiceStatus: InvoiceStatus,
  orderStatus: OrderStatus,
): PaymentDecision {
  if (event === 'PAID' && invoiceStatus === 'paid') {
    return ['packing', 'shipping', 'delivered'].includes(orderStatus ?? '')
      ? 'duplicate' : 'conflict';
  }
  if (event === 'EXPIRED' && invoiceStatus === 'expired') {
    return orderStatus === 'expired' ? 'duplicate' : 'conflict';
  }
  if (invoiceStatus !== 'pending' || orderStatus !== 'waiting_payment') {
    return 'conflict';
  }
  return event === 'PAID' ? 'pay' : 'expire';
}
