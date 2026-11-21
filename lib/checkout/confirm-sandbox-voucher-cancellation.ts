import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { checkoutPaymentAttempts, invoices, orders } from '@/lib/db/schema';
import { getSandboxInvoice } from '@/lib/xendit';
import { sandboxVoucherEnabled } from './sandbox-voucher-gate';
import {
  SandboxWebhookRejected, settleConfirmedSandboxCancellation,
} from './process-sandbox-webhook';

export async function confirmSandboxVoucherCancellation(orderId: number, userId: number) {
  if (!sandboxVoucherEnabled()) throw new SandboxWebhookRejected(404, 'Not available');
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.userId !== userId || order.voucherId === null ||
      !/^SBX-[a-f0-9]{36}$/.test(order.orderNumber)) {
    throw new SandboxWebhookRejected(404, 'Order tidak ditemukan');
  }
  if (order.status !== 'waiting_payment' && order.status !== 'cancelled') {
    return { decision: 'conflict' as const, orderId };
  }
  const invoiceRows = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(2);
  const attempts = await db.select().from(checkoutPaymentAttempts)
    .where(eq(checkoutPaymentAttempts.orderId, orderId)).limit(2);
  const [invoice] = invoiceRows;
  const [attempt] = attempts;
  const amount = Number(order.total);
  if (invoiceRows.length !== 1 || attempts.length !== 1 || !invoice.xenditId ||
      attempt.mode !== 'sandbox' || attempt.xenditId !== invoice.xenditId ||
      attempt.externalId !== order.orderNumber || Number(attempt.amount) !== amount ||
      Number(invoice.amount) !== amount || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new SandboxWebhookRejected(409, 'Identitas invoice atau attempt memerlukan rekonsiliasi');
  }
  const checkedAt = Date.now();
  let remote: Awaited<ReturnType<typeof getSandboxInvoice>>;
  try {
    remote = await getSandboxInvoice(invoice.xenditId);
  } catch {
    throw new SandboxWebhookRejected(503, 'Status invoice TEST belum dapat diverifikasi');
  }
  if (remote.id !== invoice.xenditId || remote.externalId !== order.orderNumber ||
      remote.amount !== amount || (remote.currency != null && remote.currency !== 'IDR')) {
    throw new SandboxWebhookRejected(409, 'Identitas invoice provider memerlukan rekonsiliasi');
  }
  if (remote.status === 'PENDING') {
    throw new SandboxWebhookRejected(409, 'Invoice TEST masih aktif');
  }
  const expiredAt = new Date(remote.expiryDate).getTime();
  if (remote.status !== 'EXPIRED' || !Number.isFinite(expiredAt) || expiredAt > Date.now()) {
    return { decision: 'conflict' as const, orderId };
  }
  return settleConfirmedSandboxCancellation({
    id: invoice.xenditId, orderNumber: order.orderNumber, amount,
    status: 'EXPIRED', paidAmount: null, paymentMethod: null, paymentChannel: null,
  }, { orderId, userId, invoiceId: invoice.id, attemptId: attempt.id, checkedAt });
}
