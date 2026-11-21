import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  invoices, orders, orderItems, orderStatusLogs, inventoryMovements,
  inventoryBalances, productVariants, products, checkoutPaymentAttempts,
} from '@/lib/db/schema';
import { sandboxPaymentDecision, type SandboxInvoiceEvent } from './sandbox-xendit-webhook';
import { sandboxLedgerWebhookTransition } from './sandbox-ledger-webhook-policy';
import { CheckoutPointsReconciliationError, restoreCheckoutMembershipPoints } from './transactional-membership-points';
import { CheckoutVoucherError, settleCheckoutVoucher } from './transactional-voucher';

export class SandboxWebhookRejected extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

type ProcessResult = { decision: 'paid' | 'expired' | 'cancelled' | 'duplicate' | 'conflict'; orderId: number };

function stockKey(productId: number, variantId: number | null): string {
  return String(productId) + ':' + String(variantId ?? 'base');
}

/** Atomically apply a sandbox invoice transition. Only SBX- orders are accepted.
 * All stock restoration, invoice/order status and history are one transaction.
 */
export function processSandboxInvoiceEvent(event: SandboxInvoiceEvent): Promise<ProcessResult> {
  return settleSandboxInvoice(event, false);
}

/** Internal command for a trusted caller with confirmed provider expiry.
 * A raw callback or customer cancellation request cannot invoke this command.
 */
export function settleConfirmedSandboxCancellation(
  evidence: SandboxInvoiceEvent & { status: 'EXPIRED' },
): Promise<ProcessResult> {
  if (evidence.status !== 'EXPIRED' || (evidence.paidAmount !== null && evidence.paidAmount !== 0)) {
    throw new SandboxWebhookRejected(409, 'Sandbox cancellation requires confirmed invoice expiry');
  }
  return settleSandboxInvoice(evidence, true);
}

async function settleSandboxInvoice(event: SandboxInvoiceEvent, cancel: boolean): Promise<ProcessResult> {
  return db.transaction(async tx => {
    const [invoice] = await tx.select().from(invoices)
      .where(eq(invoices.xenditId, event.id)).for('update').limit(1);
    if (!invoice) {
      // Event can arrive before the invoice row is committed. Retry.
      throw new SandboxWebhookRejected(503, 'Invoice belum tercatat; coba lagi');
    }

    const [order] = await tx.select().from(orders)
      .where(eq(orders.id, invoice.orderId)).for('update').limit(1);
    if (!order || !order.orderNumber.startsWith('SBX-')) {
      throw new SandboxWebhookRejected(409, 'Bukan order sandbox');
    }

    if (event.orderNumber !== order.orderNumber ||
        Number(invoice.amount) !== event.amount ||
        Number(order.total) !== event.amount) {
      throw new SandboxWebhookRejected(409, 'Identitas atau nominal invoice tidak cocok');
    }

    // Legacy SBX orders predate the attempt ledger and remain supported.
    // For ledger-backed orders, validate the provider identity before ANY
    // payment, stock or history transition. Lock alongside invoice and order
    // to serialize concurrent/replayed callbacks.
    const ledgerRows = await tx.select({
      id: checkoutPaymentAttempts.id,
      mode: checkoutPaymentAttempts.mode,
      externalId: checkoutPaymentAttempts.externalId,
      xenditId: checkoutPaymentAttempts.xenditId,
      amount: checkoutPaymentAttempts.amount,
      status: checkoutPaymentAttempts.status,
    }).from(checkoutPaymentAttempts)
      .where(eq(checkoutPaymentAttempts.orderId, order.id))
      .for('update').limit(2);
    if (ledgerRows.length > 1) {
      // A future repay workflow must explicitly select its active attempt.
      // Never guess which payment attempt this callback should settle.
      throw new SandboxWebhookRejected(503, 'Multiple payment attempts require reconciliation');
    }
    const ledger = ledgerRows[0] ?? null;
    if (ledger && (ledger.mode !== 'sandbox' ||
        ledger.externalId !== order.orderNumber ||
        ledger.xenditId !== event.id ||
        Number(ledger.amount) !== event.amount)) {
      throw new SandboxWebhookRejected(503, 'Payment attempt identity mismatch');
    }

    if (cancel && (order.voucherId === null || !ledger)) {
      throw new SandboxWebhookRejected(409, 'Atomic sandbox cancellation requires a voucher order and payment attempt');
    }

    const pendingDecision = sandboxPaymentDecision(event.status, invoice.status, order.status);
    const decision = cancel
      ? invoice.status === 'cancelled' && order.status === 'cancelled' && ledger?.status === 'expired'
        ? 'duplicate'
        : pendingDecision === 'expire' ? 'cancel' : 'conflict'
      : pendingDecision;
    if (decision === 'conflict') {
      // PAID after EXPIRED or EXPIRED after PAID cannot reverse stock/order.
      return { decision, orderId: order.id };
    }

    const ledgerTransition = ledger
      ? sandboxLedgerWebhookTransition(ledger.status, event.status) : null;
    if (ledgerTransition === 'conflict') {
      // An incompatible ledger terminal state requires operator review.
      return { decision: 'conflict', orderId: order.id };
    }

    if (decision === 'duplicate') {
      // Repair a pre-existing paid/expired invoice whose ledger was still
      // READY (e.g. order settled before this upgrade), but NEVER repeat
      // fulfillment, order status logs, or stock movements.
      if (ledger && ledgerTransition !== 'already') {
        const [updated] = await tx.update(checkoutPaymentAttempts)
          .set({ status: ledgerTransition!, resolvedAt: new Date() })
          .where(and(
            eq(checkoutPaymentAttempts.id, ledger.id),
            eq(checkoutPaymentAttempts.status, ledger.status),
            eq(checkoutPaymentAttempts.mode, 'sandbox'),
            eq(checkoutPaymentAttempts.xenditId, event.id),
          ));
        if (updated.affectedRows !== 1) {
          throw new SandboxWebhookRejected(503, 'Payment ledger reconciliation failed');
        }
      }
      return { decision, orderId: order.id };
    }

    if (ledger && ledgerTransition === 'already') {
      // The ledger cannot be terminal while invoice/order still say pending.
      // Never apply an ambiguous settlement silently.
      return { decision: 'conflict', orderId: order.id };
    }

    if (decision !== 'pay') {
      // Restore ONLY recorded sale movements, to the original location even if
      // the online default location has since changed.
      const movements = await tx.select().from(inventoryMovements)
        .where(and(eq(inventoryMovements.referenceType, 'order'),
          eq(inventoryMovements.referenceId, order.id),
          eq(inventoryMovements.type, 'online_sale')))
        .orderBy(inventoryMovements.id);
      const items = await tx.select().from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      if (items.length === 0 || movements.length === 0) {
        throw new SandboxWebhookRejected(503, 'Riwayat stok order tidak lengkap');
      }
      const expected = new Map<string, number>();
      for (const item of items) {
        if (!item.productId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
          throw new SandboxWebhookRejected(503, 'Item order tidak valid');
        }
        const key = stockKey(item.productId, item.variantId);
        expected.set(key, (expected.get(key) ?? 0) + item.quantity);
      }
      const actual = new Map<string, number>();
      for (const movement of movements) {
        if (!Number.isSafeInteger(movement.quantityDelta) || movement.quantityDelta >= 0) {
          throw new SandboxWebhookRejected(503, 'Pergerakan stok tidak valid');
        }
        const key = stockKey(movement.productId, movement.variantId);
        actual.set(key, (actual.get(key) ?? 0) - movement.quantityDelta);
      }
      if (expected.size !== actual.size ||
        [...expected].some(([key, qty]) => actual.get(key) !== qty)) {
        throw new SandboxWebhookRejected(503, 'Saldo item dan mutasi stok tidak cocok');
      }

      for (const movement of movements) {
        const quantity = -movement.quantityDelta;
        const condition = and(
          eq(inventoryBalances.locationId, movement.locationId),
          eq(inventoryBalances.productId, movement.productId),
          movement.variantId === null ? isNull(inventoryBalances.variantId)
            : eq(inventoryBalances.variantId, movement.variantId),
        );
        const [balance] = await tx.select().from(inventoryBalances)
          .where(condition).for('update').limit(1);
        if (!balance) throw new SandboxWebhookRejected(503, 'Saldo Gudang Online tidak ditemukan');

        const [balanceUpdated] = await tx.update(inventoryBalances)
          .set({ quantity: sql.join([sql.raw('quantity + '), sql.param(quantity)]) })
          .where(eq(inventoryBalances.id, balance.id));
        if (balanceUpdated.affectedRows !== 1) {
          throw new SandboxWebhookRejected(503, 'Gagal memulihkan saldo inventory');
        }
        if (movement.variantId !== null) {
          const [variantUpdated] = await tx.update(productVariants)
            .set({ stock: sql.join([sql.raw('stock + '), sql.param(quantity)]) })
            .where(and(eq(productVariants.id, movement.variantId),
              eq(productVariants.productId, movement.productId)));
          if (variantUpdated.affectedRows !== 1) {
            throw new SandboxWebhookRejected(503, 'Gagal memulihkan stok varian');
          }
        } else {
          const [productUpdated] = await tx.update(products)
            .set({ stock: sql.join([sql.raw('stock + '), sql.param(quantity)]) })
            .where(eq(products.id, movement.productId));
          if (productUpdated.affectedRows !== 1) {
            throw new SandboxWebhookRejected(503, 'Gagal memulihkan stok produk');
          }
        }
        await tx.insert(inventoryMovements).values({
          locationId: movement.locationId,
          productId: movement.productId,
          variantId: movement.variantId,
          quantityDelta: quantity,
          balanceAfter: balance.quantity + quantity,
          type: 'return',
          referenceType: 'order',
          referenceId: order.id,
          notes: decision === 'cancel' ? 'sandbox invoice cancelled' : 'sandbox invoice expired',
        });
      }
    }

    if (decision === 'pay') {
      await tx.update(invoices).set({
        status: 'paid',
        paymentMethod: event.paymentMethod,
        paymentChannel: event.paymentChannel,
        paidAt: sql.raw('NOW()'),
      }).where(eq(invoices.id, invoice.id));
      await tx.update(orders).set({
        status: 'packing',
        paidAt: sql.raw('NOW()'),
      }).where(eq(orders.id, order.id));
    } else if (decision === 'cancel') {
      const cancelledAt = new Date();
      await tx.update(invoices).set({ status: 'cancelled', cancelledAt }).where(eq(invoices.id, invoice.id));
      await tx.update(orders).set({ status: 'cancelled', cancelledAt }).where(eq(orders.id, order.id));
    } else {
      await tx.update(invoices).set({ status: 'expired' })
        .where(eq(invoices.id, invoice.id));
      await tx.update(orders).set({
        status: 'expired',
        expiredAt: sql.raw('NOW()'),
      }).where(eq(orders.id, order.id));
    }

    // SBX orders with a voucher ID carry the atomic checkout opt-in.
    // Duplicate/conflicting events return earlier, even if the grant was reused.
    if (order.voucherId !== null) {
      try {
        await settleCheckoutVoucher(tx, {
          orderId: order.id, userId: order.userId, voucherId: order.voucherId,
          subtotal: Number(order.subtotal), outcome: decision === 'pay' ? 'paid' : 'expired',
        });
        if (decision !== 'pay') await restoreCheckoutMembershipPoints(tx, {
          orderId: order.id, userId: order.userId, pointsRedeemed: order.pointsRedeemed,
        });
      } catch (error) {
        if (error instanceof CheckoutVoucherError || error instanceof CheckoutPointsReconciliationError) {
          throw new SandboxWebhookRejected(503, error.message);
        }
        throw error;
      }
    }

    const outcome = decision === 'pay' ? 'paid' : decision === 'cancel' ? 'cancelled' : 'expired';
    await tx.insert(orderStatusLogs).values({
      orderId: order.id,
      fromStatus: order.status!,
      toStatus: outcome === 'paid' ? 'packing' : outcome,
      changedBy: decision === 'cancel' ? 'system:sandbox-cancellation' : 'webhook:xendit:sandbox',
    });

    if (ledger) {
      // Same transaction as invoice, order, stock restoration and audit log.
      // On any failure, ALL effects roll back and Xendit can retry.
      const [updated] = await tx.update(checkoutPaymentAttempts).set({
        status: ledgerTransition === 'paid' ? 'paid' : 'expired',
        resolvedAt: new Date(),
      }).where(and(
        eq(checkoutPaymentAttempts.id, ledger.id),
        eq(checkoutPaymentAttempts.status, ledger.status),
        eq(checkoutPaymentAttempts.mode, 'sandbox'),
        eq(checkoutPaymentAttempts.xenditId, event.id),
      ));
      if (updated.affectedRows !== 1) {
        throw new SandboxWebhookRejected(503, 'Payment attempt settlement failed');
      }
    }
    return { decision: outcome, orderId: order.id };
  });
}
