// app/api/webhooks/xendit/route.ts — Xendit payment webhook
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  invoices, orders, orderStatusLogs,
  memberships, memberTiers, pointsLedger, vouchers,
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { restoreStock } from '@/lib/stock';
import { calculatePointsEarned } from '@/lib/membership-utils';

export async function POST(request: Request) {
  // Verify callback token
  const callbackToken = request.headers.get('x-callback-token');
  const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN;

  if (!callbackToken || callbackToken !== expectedToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id: xenditId, status, payment_method, payment_channel, paid_at } = body;

    if (!xenditId || !status) {
      return NextResponse.json({ success: true, message: 'Ignored: missing data' });
    }

    // Find invoice by xenditId
    const invRows = await db.select().from(invoices)
      .where(eq(invoices.xenditId, xenditId))
      .limit(1);

    if (invRows.length === 0) {
      return NextResponse.json({ success: true, message: 'Ignored: unknown invoice' });
    }

    const invoice = invRows[0];

    // Get order
    const orderRows = await db.select().from(orders)
      .where(eq(orders.id, invoice.orderId))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ success: true, message: 'Ignored: order not found' });
    }

    const order = orderRows[0];

    if (status === 'PAID') {
      // Idempotent: skip if already paid
      if (invoice.status === 'paid') {
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // Update invoice
      await db.update(invoices).set({
        status: 'paid',
        paymentMethod: payment_method,
        paymentChannel: payment_channel,
        paidAt: sql`NOW()`,
      }).where(eq(invoices.id, invoice.id));

      // Transition order to packing
      await db.update(orders).set({
        status: 'packing',
        paidAt: sql`NOW()`,
      }).where(eq(orders.id, order.id));

      // Audit log
      await db.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: order.status!,
        toStatus: 'packing',
        changedBy: 'webhook:xendit',
      });

      // Membership: earn points + tier upgrade + voucher usedCount
      if (order.userId) {
        try {
          await db.transaction(async (tx) => {
            const memberRow = await tx
              .select()
              .from(memberships)
              .innerJoin(memberTiers, eq(memberships.tierId, memberTiers.id))
              .where(eq(memberships.userId, order.userId!))
              .limit(1)
              .then((r) => r[0] ?? null);

            if (memberRow) {
              const subtotal = Number(order.subtotal);
              const multiplier = memberRow.member_tiers.pointMultiplier ?? 1;
              const delta = calculatePointsEarned(subtotal, multiplier);
              const newPoints = (memberRow.memberships.points ?? 0) + delta;
              const newTotalSpend = (memberRow.memberships.totalSpend ?? 0) + subtotal;

              // Check tier upgrade
              const allTiers = await tx
                .select()
                .from(memberTiers)
                .orderBy(memberTiers.sortOrder);

              let newTierId = memberRow.memberships.tierId;
              const curIdx = allTiers.findIndex((t) => t.id === memberRow.memberships.tierId);
              for (let i = curIdx + 1; i < allTiers.length; i++) {
                if (newTotalSpend >= (allTiers[i].minSpend ?? 0)) newTierId = allTiers[i].id;
                else break;
              }

              // Update membership
              await tx
                .update(memberships)
                .set({ points: newPoints, totalSpend: newTotalSpend, tierId: newTierId })
                .where(eq(memberships.id, memberRow.memberships.id));

              // Write to points_ledger (audit trail)
              await tx.insert(pointsLedger).values({
                membershipId: memberRow.memberships.id,
                orderId: order.id,
                delta,
                reason: 'order_earn',
              });
            }

            // Increment voucher usedCount
            if (order.voucherId) {
              await tx
                .update(vouchers)
                .set({ usedCount: sql`${vouchers.usedCount} + 1` })
                .where(eq(vouchers.id, order.voucherId));
            }
          });
        } catch (memberErr) {
          console.error('Membership update error:', memberErr);
        }
      }
    }

    if (status === 'EXPIRED') {
      // Idempotent: skip if already expired
      if (invoice.status === 'expired') {
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // Update invoice
      await db.update(invoices).set({
        status: 'expired',
      }).where(eq(invoices.id, invoice.id));

      // Transition order to expired
      await db.update(orders).set({
        status: 'expired',
        expiredAt: sql`NOW()`,
      }).where(eq(orders.id, order.id));

      // Restore stock
      await restoreStock(order.id);

      // Audit log
      await db.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: order.status!,
        toStatus: 'expired',
        changedBy: 'webhook:xendit',
      });

      // Restore redeemed points if any
      if ((order.pointsRedeemed ?? 0) > 0 && order.userId) {
        try {
          await db.transaction(async (tx) => {
            const memberRow = await tx
              .select()
              .from(memberships)
              .where(eq(memberships.userId, order.userId!))
              .limit(1)
              .then((r) => r[0] ?? null);
            if (memberRow) {
              await tx.update(memberships)
                .set({ points: (memberRow.points ?? 0) + order.pointsRedeemed! })
                .where(eq(memberships.id, memberRow.id));
              await tx.insert(pointsLedger).values({
                membershipId: memberRow.id,
                orderId: order.id,
                delta: order.pointsRedeemed!,
                reason: 'order_expire_restore',
              });
            }
          });
        } catch (err) {
          console.error('Points restore error:', err);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Xendit webhook error:', error);
    return NextResponse.json({ success: true, message: 'Error handled' });
  }
}
