import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  invoices, orders, orderItems, orderStatusLogs, inventoryMovements,
  inventoryBalances, productVariants, products,
} from '@/lib/db/schema';
import { sandboxPaymentDecision, type SandboxInvoiceEvent } from './sandbox-xendit-webhook';

export class SandboxWebhookRejected extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

type ProcessResult = { decision: 'paid' | 'expired' | 'duplicate' | 'conflict'; orderId: number };

function stockKey(productId: number, variantId: number | null): string {
  return String(productId) + ':' + String(variantId ?? 'base');
}

/** Atomically apply a sandbox invoice transition. Only SBX- orders are accepted.
 * All stock restoration, invoice/order status and history are one transaction.
 */
export async function processSandboxInvoiceEvent(event: SandboxInvoiceEvent): Promise<ProcessResult> {
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

    const decision = sandboxPaymentDecision(event.status, invoice.status, order.status);
    if (decision === 'duplicate' || decision === 'conflict') {
      return { decision, orderId: order.id };
    }

    if (decision === 'expire') {
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
          notes: 'sandbox invoice expired',
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
    } else {
      await tx.update(invoices).set({ status: 'expired' })
        .where(eq(invoices.id, invoice.id));
      await tx.update(orders).set({
        status: 'expired',
        expiredAt: sql.raw('NOW()'),
      }).where(eq(orders.id, order.id));
    }

    await tx.insert(orderStatusLogs).values({
      orderId: order.id,
      fromStatus: order.status!,
      toStatus: decision === 'pay' ? 'packing' : 'expired',
      changedBy: 'webhook:xendit:sandbox',
    });
    return { decision: decision === 'pay' ? 'paid' : 'expired', orderId: order.id };
  });
}
