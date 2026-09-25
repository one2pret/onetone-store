'use server';

import { desc, eq, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, userVouchers, users, vouchers } from '@/lib/db/schema';

const optionalInt = z.preprocess(
  (value) => value === '' || value === null || value === undefined ? null : value,
  z.coerce.number().int().min(0).nullable(),
);
const optionalDate = z.preprocess(
  (value) => value === '' || value === null || value === undefined ? null : value,
  z.coerce.date().nullable(),
);

const voucherSchema = z.object({
  code: z.string().trim().min(3).max(50).regex(/^[A-Z0-9_-]+$/, 'Gunakan huruf besar, angka, - atau _'),
  name: z.string().trim().min(3, 'Nama voucher wajib diisi').max(120),
  description: z.string().trim().max(500).optional(),
  type: z.enum(['fixed', 'percent', 'free_shipping']),
  value: z.coerce.number().int().min(0),
  minSpend: z.coerce.number().int().min(0),
  audience: z.enum(['public', 'membership', 'new_user']),
  tierId: optionalInt,
  quota: optionalInt,
  validDaysAfterGrant: optionalInt,
  maxUsesPerUser: z.coerce.number().int().min(1).default(1),
  firstOrderOnly: z.boolean(),
  allowPoints: z.boolean(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  isActive: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.type === 'percent' && (data.value < 1 || data.value > 100)) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'Persentase harus 1 sampai 100' });
  }
  if (data.type === 'fixed' && data.value < 1) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'Nominal diskon harus lebih dari 0' });
  }
  if (data.audience === 'membership' && !data.tierId) {
    ctx.addIssue({ code: 'custom', path: ['tierId'], message: 'Pilih tier minimum' });
  }
  if (data.audience === 'new_user' && !data.validDaysAfterGrant) {
    ctx.addIssue({ code: 'custom', path: ['validDaysAfterGrant'], message: 'Masa berlaku setelah pemberian wajib diisi' });
  }
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Waktu selesai harus setelah waktu mulai' });
  }
});

export type VoucherActionState = {
  success: boolean;
  voucherId?: number;
  errors?: Record<string, string[]>;
  error?: string;
} | null;

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === 'admin';
}

function valuesFromForm(formData: FormData) {
  const type = formData.get('type');
  return {
    code: String(formData.get('code') ?? '').trim().toUpperCase(),
    name: formData.get('name'),
    description: formData.get('description') || '',
    type,
    value: type === 'free_shipping' ? 0 : formData.get('value'),
    minSpend: formData.get('minSpend') || 0,
    audience: formData.get('audience'),
    tierId: formData.get('tierId'),
    quota: formData.get('quota'),
    validDaysAfterGrant: formData.get('validDaysAfterGrant'),
    maxUsesPerUser: formData.get('maxUsesPerUser') || 1,
    firstOrderOnly: formData.get('firstOrderOnly') === 'on',
    allowPoints: formData.get('allowPoints') === 'on',
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt'),
    isActive: formData.get('isActive') === 'on',
  };
}

function persistable(data: z.infer<typeof voucherSchema>) {
  return {
    ...data,
    description: data.description || null,
    tierId: data.audience === 'membership' ? data.tierId : null,
    validDaysAfterGrant: data.audience === 'new_user' ? data.validDaysAfterGrant : null,
  };
}

export async function getAdminVouchers() {
  if (!(await requireAdmin())) return [];
  const [campaigns, grants, voucherOrders] = await Promise.all([
    db.select().from(vouchers).orderBy(desc(vouchers.id)),
    db.select().from(userVouchers),
    db.select({ id: orders.id, voucherId: orders.voucherId, status: orders.status })
      .from(orders).where(isNotNull(orders.voucherId)),
  ]);

  return campaigns.map((voucher) => {
    const campaignGrants = grants.filter((grant) => grant.voucherId === voucher.id);
    const campaignOrders = voucherOrders.filter((order) => order.voucherId === voucher.id);
    return {
      ...voucher,
      stats: {
        granted: campaignGrants.length,
        available: campaignGrants.filter((grant) => grant.status === 'available').length,
        reserved: campaignGrants.filter((grant) => grant.status === 'reserved').length,
        redeemed: campaignOrders.filter((order) => ['packing', 'shipping', 'delivered'].includes(order.status ?? '')).length,
        expired: campaignGrants.filter((grant) => grant.status === 'expired').length,
        orders: campaignOrders.length,
      },
    };
  });
}

export async function getAdminVoucher(id: number) {
  if (!(await requireAdmin())) return null;
  return db.select().from(vouchers).where(eq(vouchers.id, id)).limit(1).then((rows) => rows[0] ?? null);
}

export async function getVoucherHistory(id: number) {
  if (!(await requireAdmin())) return null;
  const voucher = await getAdminVoucher(id);
  if (!voucher) return null;

  const [grantRows, orderRows] = await Promise.all([
    db.select({
      id: userVouchers.id,
      status: userVouchers.status,
      grantedAt: userVouchers.grantedAt,
      expiresAt: userVouchers.expiresAt,
      reservedAt: userVouchers.reservedAt,
      redeemedAt: userVouchers.redeemedAt,
      reservedOrderId: userVouchers.reservedOrderId,
      redeemedOrderId: userVouchers.redeemedOrderId,
      userName: users.name,
      userEmail: users.email,
    }).from(userVouchers)
      .leftJoin(users, eq(userVouchers.userId, users.id))
      .where(eq(userVouchers.voucherId, id))
      .orderBy(desc(userVouchers.grantedAt))
      .limit(100),
    db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      discountAmount: orders.discountAmount,
      total: orders.total,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      userName: users.name,
      userEmail: users.email,
    }).from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.voucherId, id))
      .orderBy(desc(orders.createdAt))
      .limit(100),
  ]);

  return { voucher, grants: grantRows, orders: orderRows };
}

export async function createVoucher(_: VoucherActionState, formData: FormData): Promise<VoucherActionState> {
  if (!(await requireAdmin())) return { success: false, error: 'Unauthorized' };
  const parsed = voucherSchema.safeParse(valuesFromForm(formData));
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };
  try {
    const inserted = await db.insert(vouchers).values(persistable(parsed.data)).$returningId();
    revalidatePath('/dashboard/vouchers');
    return { success: true, voucherId: inserted[0]?.id };
  } catch (error) {
    const dbError = error as { code?: string };
    return { success: false, error: dbError.code === 'ER_DUP_ENTRY' ? 'Kode voucher sudah digunakan' : 'Gagal membuat voucher' };
  }
}

export async function updateVoucher(id: number, _: VoucherActionState, formData: FormData): Promise<VoucherActionState> {
  if (!(await requireAdmin())) return { success: false, error: 'Unauthorized' };
  const parsed = voucherSchema.safeParse(valuesFromForm(formData));
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors };

  const current = await getAdminVoucher(id);
  if (!current) return { success: false, error: 'Voucher tidak ditemukan' };
  const [grant] = await db.select({ id: userVouchers.id }).from(userVouchers).where(eq(userVouchers.voucherId, id)).limit(1);
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.voucherId, id)).limit(1);
  const hasHistory = Boolean(grant || order);
  if (hasHistory && (
    parsed.data.code !== current.code
    || parsed.data.type !== current.type
    || parsed.data.value !== (current.value ?? 0)
    || parsed.data.audience !== current.audience
  )) {
    return { success: false, error: 'Kode, tipe, nilai, dan audience dikunci karena voucher sudah memiliki histori' };
  }

  try {
    await db.update(vouchers).set(persistable(parsed.data)).where(eq(vouchers.id, id));
    revalidatePath('/dashboard/vouchers');
    revalidatePath(`/dashboard/vouchers/${id}`);
    revalidatePath('/account/vouchers');
    return { success: true, voucherId: id };
  } catch (error) {
    const dbError = error as { code?: string };
    return { success: false, error: dbError.code === 'ER_DUP_ENTRY' ? 'Kode voucher sudah digunakan' : 'Gagal memperbarui voucher' };
  }
}

export async function toggleVoucherActive(id: number, active: boolean) {
  if (!(await requireAdmin())) return { success: false, error: 'Unauthorized' };
  const voucher = await getAdminVoucher(id);
  if (!voucher || voucher.archivedAt) return { success: false, error: 'Voucher tidak ditemukan atau sudah diarsipkan' };
  await db.update(vouchers).set({ isActive: active }).where(eq(vouchers.id, id));
  revalidatePath('/dashboard/vouchers');
  revalidatePath('/account/vouchers');
  return { success: true };
}

export async function deleteOrArchiveVoucher(id: number) {
  if (!(await requireAdmin())) return { success: false, error: 'Unauthorized' };
  const [grant] = await db.select({ id: userVouchers.id }).from(userVouchers).where(eq(userVouchers.voucherId, id)).limit(1);
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.voucherId, id)).limit(1);
  if (grant || order) {
    await db.update(vouchers).set({ isActive: false, archivedAt: new Date() }).where(eq(vouchers.id, id));
    revalidatePath('/dashboard/vouchers');
    revalidatePath('/account/vouchers');
    return { success: true, mode: 'archived' as const };
  }
  await db.delete(vouchers).where(eq(vouchers.id, id));
  revalidatePath('/dashboard/vouchers');
  return { success: true, mode: 'deleted' as const };
}
