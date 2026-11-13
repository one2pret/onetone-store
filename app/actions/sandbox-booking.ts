'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, invoices, orderItems, shippings, storeSettings, couriers, sandboxBookings, sandboxBookingEvents } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { bookingSnapshotHash, buildSandboxBookingPayload, requestSandboxBooking, retrieveSandboxBooking, sandboxBookingEnabled, type BookingResult } from '@/lib/checkout/sandbox-booking';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function requireAdmin(orderId: number) {
  const session = await auth();
  if (session?.user?.role !== 'admin' || !Number.isSafeInteger(Number(session.user.id)) ||
      !Number.isSafeInteger(orderId) || orderId <= 0) throw new Error('Akses booking ditolak.');
  if (!sandboxBookingEnabled()) throw new Error('Booking sandbox dinonaktifkan.');
  return Number(session.user.id);
}

async function loadPayload(tx: Transaction, orderId: number) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
  if (!order) throw new Error('Order tidak ditemukan.');
  const existing = await tx.select().from(sandboxBookings).where(eq(sandboxBookings.orderId, orderId));
  if (existing.length) throw new Error('Reservasi booking sudah ada. Jangan kirim ulang; periksa status atau rekonsiliasi.');
  const payments = await tx.select().from(invoices).where(eq(invoices.orderId, orderId)).for('update');
  const shipments = await tx.select().from(shippings).where(eq(shippings.orderId, orderId)).for('update');
  if (payments.length !== 1 || shipments.length !== 1 || Number(payments[0].amount) !== Number(order.total)) {
    throw new Error('Invoice atau pengiriman tidak tunggal/valid.');
  }
  const shipping = shipments[0];
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.id)).for('update');
  const settings = await tx.select().from(storeSettings);
  const config = Object.fromEntries(settings.map(row => [row.key, row.value]));
  const active = await tx.select().from(couriers).where(eq(couriers.code, shipping.courierCompany ?? ''));
  if (!active.some(courier => courier.isActive)) throw new Error('Kurir tidak aktif.');
  return buildSandboxBookingPayload(order.orderNumber, {
    orderStatus: order.status, invoiceStatus: payments[0].status,
    hasSandboxBiteshipKey: sandboxBookingEnabled(),
    hasTracking: !!shipping.trackingId || !!shipping.waybillId || !!shipping.status,
    origin: { contactName: config.store_name, contactPhone: config.store_phone,
      address: config.store_address, latitude: config.store_latitude, longitude: config.store_longitude },
    shipping: { ...shipping, address: [shipping.address, shipping.addressDetail].filter(Boolean).join(', ') },
    items: items.map(item => ({ name: item.productName, quantity: item.quantity,
      unitPrice: Number(item.price), weightGrams: item.unitWeightGrams })),
  });
}

export async function previewSandboxBooking(orderId: number) {
  try {
    await requireAdmin(orderId);
    const payload = await db.transaction(tx => loadPayload(tx, orderId));
    return { success: true as const, payload, hash: bookingSnapshotHash(payload) };
  } catch (error) {
    return { success: false as const, error: safeError(error) };
  }
}

function safeError(error: unknown) {
  // Only our validation messages may reach the UI; SQL/provider errors may contain PII.
  const message = error instanceof Error ? error.message : '';
  const allowed = ['Akses booking', 'Booking sandbox', 'Order tidak ditemukan', 'Reservasi booking',
    'Invoice atau', 'Kurir tidak', 'Data booking', 'Snapshot berubah', 'Konfirmasi wajib',
    'Reservasi tidak', 'Tunggu satu menit', 'ID Biteship tidak'];
  return allowed.some(prefix => message.startsWith(prefix)) ? message : 'Operasi belum dapat dipastikan. Periksa reservasi; jangan ulangi POST.';
}

async function persistResult(bookingId: number, actorId: number, result: BookingResult) {
  return db.transaction(async tx => {
    const [booking] = await tx.select().from(sandboxBookings).where(eq(sandboxBookings.id, bookingId)).for('update');
    if (!booking) throw new Error('Reservasi tidak ditemukan.');
    if (booking.status !== 'booked' ||
        (result.status === 'booked' && result.externalOrderId === booking.externalOrderId)) {
      await tx.update(sandboxBookings).set({ status: result.status, respondedAt: new Date(),
        externalOrderId: result.externalOrderId ?? booking.externalOrderId,
        waybillId: result.waybillId ?? booking.waybillId,
        courierTrackingId: result.courierTrackingId ?? booking.courierTrackingId }).where(eq(sandboxBookings.id, bookingId));
    }
    await tx.insert(sandboxBookingEvents).values({ bookingId, actorId, event: result.event });
    return booking.status === 'booked' ? 'booked' : result.status;
  });
}

export async function bookSandboxShipment(orderId: number, reviewedHash: string, confirmed: boolean) {
  try {
    const actorId = await requireAdmin(orderId);
    if (confirmed !== true) throw new Error('Konfirmasi wajib diberikan.');
    const reservation = await db.transaction(async tx => {
      const payload = await loadPayload(tx, orderId);
      const hash = bookingSnapshotHash(payload);
      if (reviewedHash !== hash) throw new Error('Snapshot berubah. Tinjau ulang sebelum booking.');
      // Commit uncertainty BEFORE POST. A crash at any later point cannot permit a second POST.
      const [inserted] = await tx.insert(sandboxBookings).values({ orderId,
        referenceId: payload.reference_id, snapshot: JSON.stringify(payload), snapshotHash: hash,
        status: 'needs_reconciliation', mode: 'sandbox' });
      const bookingId = Number(inserted.insertId);
      await tx.insert(sandboxBookingEvents).values({ bookingId, actorId, event: 'reserved_admin_confirmed' });
      return { bookingId, payload };
    });
    const result = await requestSandboxBooking(reservation.payload);
    const status = await persistResult(reservation.bookingId, actorId, result);
    revalidatePath(`/dashboard/orders/${orderId}`);
    return { success: true as const, status };
  } catch (error) {
    return { success: false as const, error: safeError(error) };
  }
}

export async function reconcileSandboxShipment(orderId: number, candidateExternalId: string) {
  try {
    const actorId = await requireAdmin(orderId);
    const [booking] = await db.select().from(sandboxBookings).where(eq(sandboxBookings.orderId, orderId));
    if (!booking || booking.mode !== 'sandbox') throw new Error('Reservasi tidak ditemukan.');
    if (Date.now() - booking.requestedAt.getTime() < 60000) throw new Error('Tunggu satu menit sebelum rekonsiliasi.');
    // A typed ID is only a candidate. Provider GET must verify the exact reserved reference.
    const result = await retrieveSandboxBooking(booking.externalOrderId ?? candidateExternalId, booking.referenceId);
    const status = await persistResult(booking.id, actorId, result);
    revalidatePath(`/dashboard/orders/${orderId}`);
    return { success: true as const, status };
  } catch (error) {
    return { success: false as const, error: safeError(error) };
  }
}
