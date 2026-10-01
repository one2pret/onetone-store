import bcrypt from 'bcryptjs';
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  memberships,
  memberTiers,
  orders,
  pointsLedger,
  posReturns,
  posCustomerLeads,
  users,
  userVouchers,
  vouchers,
} from '@/lib/db/schema';
import {
  hashPosLeadActivationToken,
  isValidPosLeadActivationToken,
} from '@/lib/pos-lead-activation-token';
import { calculateGrantExpiry, createInternalCustomerEmail } from '@/lib/registration-utils';
import { calculateMembershipOrderReward, calculateReturnSpendTarget } from '@/lib/membership-rewards';

export type PosLeadActivationInfo =
  | { valid: true; name: string; maskedPhone: string; maskedEmail: string | null; expiresAt: string }
  | { valid: false; reason: 'invalid' | 'expired' | 'used' };

export type ActivatePosLeadResult =
  | { success: true; email: string | null; phone: string; welcomeVoucherCount: number; linkedOrderCount: number; pointsEarned: number }
  | { success: false; field?: 'email' | 'password' | 'passwordConfirmation'; error: string };

function maskEmail(value: string | null) {
  if (!value) return null;
  const [localPart, domain] = value.split('@');
  if (!domain) return null;
  return `${localPart.slice(0, 2)}${'•'.repeat(Math.max(3, localPart.length - 2))}@${domain}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : '••••';
}

export async function getPosLeadActivationInfo(token: string): Promise<PosLeadActivationInfo> {
  if (!isValidPosLeadActivationToken(token)) return { valid: false, reason: 'invalid' };

  const rows = await db.select({
    name: posCustomerLeads.name,
    phone: posCustomerLeads.phoneNormalized,
    email: posCustomerLeads.email,
    status: posCustomerLeads.status,
    claimedUserId: posCustomerLeads.claimedUserId,
    expiresAt: posCustomerLeads.activationExpiresAt,
  }).from(posCustomerLeads)
    .where(eq(posCustomerLeads.activationTokenHash, hashPosLeadActivationToken(token)))
    .limit(1);

  const lead = rows[0];
  if (!lead) return { valid: false, reason: 'invalid' };
  if (lead.status === 'activated' || lead.claimedUserId) return { valid: false, reason: 'used' };
  if (lead.status !== 'pending') return { valid: false, reason: 'invalid' };
  if (!lead.expiresAt || lead.expiresAt.getTime() <= Date.now()) {
    return { valid: false, reason: 'expired' };
  }

  return {
    valid: true,
    name: lead.name,
    maskedPhone: maskPhone(lead.phone),
    maskedEmail: maskEmail(lead.email),
    expiresAt: lead.expiresAt.toISOString(),
  };
}

export async function activatePosCustomerLead(input: {
  token: string;
  email?: string;
  password: string;
}): Promise<ActivatePosLeadResult> {
  if (!isValidPosLeadActivationToken(input.token)) {
    return { success: false, error: 'Tautan aktivasi tidak valid' };
  }

  const suppliedEmail = input.email?.trim().toLowerCase() || null;
  const passwordHash = await bcrypt.hash(input.password, 10);
  const tokenHash = hashPosLeadActivationToken(input.token);
  const activatedAt = new Date();

  try {
    return await db.transaction(async tx => {
      const leadRows = await tx.select({
        id: posCustomerLeads.id,
        name: posCustomerLeads.name,
        phone: posCustomerLeads.phoneNormalized,
        email: posCustomerLeads.email,
        status: posCustomerLeads.status,
        claimedUserId: posCustomerLeads.claimedUserId,
        expiresAt: posCustomerLeads.activationExpiresAt,
      }).from(posCustomerLeads)
        .where(eq(posCustomerLeads.activationTokenHash, tokenHash))
        .limit(1)
        .for('update');
      const lead = leadRows[0];

      if (!lead) return { success: false, error: 'Tautan aktivasi tidak valid' } as const;
      if (lead.status === 'activated' || lead.claimedUserId) {
        return { success: false, error: 'Tautan aktivasi sudah pernah digunakan' } as const;
      }
      if (lead.status !== 'pending' || !lead.expiresAt || lead.expiresAt.getTime() <= activatedAt.getTime()) {
        if (lead.status === 'pending') {
          await tx.update(posCustomerLeads)
            .set({ status: 'expired', activationTokenHash: null, activationExpiresAt: null })
            .where(eq(posCustomerLeads.id, lead.id));
        }
        return { success: false, error: 'Tautan aktivasi sudah kedaluwarsa. Minta kasir membuat QR baru.' } as const;
      }

      const email = suppliedEmail ?? lead.email?.trim().toLowerCase() ?? null;
      const storedEmail = email ?? createInternalCustomerEmail(lead.phone);

      const existingUsers = await tx.select({ id: users.id, email: users.email, phone: users.phone })
        .from(users)
        .where(and(
          isNull(users.deletedAt),
          or(email ? eq(users.email, email) : undefined, eq(users.phone, lead.phone)),
        ))
        .limit(1);
      const existingUser = existingUsers[0];
      if (existingUser) {
        const emailConflict = Boolean(email && existingUser.email.toLowerCase() === email);
        const field = emailConflict ? 'email' as const : undefined;
        return {
          success: false,
          field,
          error: emailConflict
            ? 'Email sudah terdaftar. Silakan masuk dengan akun tersebut.'
            : 'Nomor telepon ini sudah terhubung dengan akun lain. Hubungi admin.',
        } as const;
      }

      const [initialTier] = await tx.select({ id: memberTiers.id })
        .from(memberTiers)
        .orderBy(asc(memberTiers.minSpend))
        .limit(1);
      if (!initialTier) throw new Error('INITIAL_TIER_NOT_CONFIGURED');

      const inserted = await tx.insert(users).values({
        name: lead.name,
        email: storedEmail,
        password: passwordHash,
        phone: lead.phone,
        role: 'customer',
      }).$returningId();
      const userId = inserted[0]?.id;
      if (!userId) throw new Error('USER_INSERT_FAILED');

      const insertedMembership = await tx.insert(memberships)
        .values({ userId, tierId: initialTier.id })
        .$returningId();
      const membershipId = insertedMembership[0]?.id;
      if (!membershipId) throw new Error('MEMBERSHIP_INSERT_FAILED');

      const campaigns = await tx.select().from(vouchers).where(and(
        eq(vouchers.audience, 'new_user'),
        eq(vouchers.isActive, true),
        isNull(vouchers.archivedAt),
        or(isNull(vouchers.startsAt), lte(vouchers.startsAt, activatedAt)),
        or(isNull(vouchers.endsAt), gte(vouchers.endsAt, activatedAt)),
      ));

      for (const campaign of campaigns) {
        await tx.insert(userVouchers).values({
          userId,
          voucherId: campaign.id,
          grantedAt: activatedAt,
          expiresAt: calculateGrantExpiry(
            activatedAt,
            campaign.validDaysAfterGrant,
            campaign.endsAt ? new Date(campaign.endsAt) : null,
          ),
        });
      }

      const linkedOrders = await tx.select({
        id: orders.id,
        subtotal: orders.subtotal,
        total: orders.total,
      })
        .from(orders)
        .where(and(
          eq(orders.posCustomerLeadId, lead.id),
          isNull(orders.userId),
          eq(orders.channel, 'pos'),
          eq(orders.status, 'delivered'),
        ))
        .orderBy(asc(orders.createdAt));
      if (linkedOrders.length > 0) {
        await tx.update(orders)
          .set({ userId })
          .where(and(eq(orders.posCustomerLeadId, lead.id), isNull(orders.userId)));
      }

      const returnTotals = linkedOrders.length > 0
        ? await tx.select({
            orderId: posReturns.orderId,
            amount: sql<string>`COALESCE(SUM(${posReturns.refundAmount}), 0)`,
          }).from(posReturns)
            .where(inArray(posReturns.orderId, linkedOrders.map(order => order.id)))
            .groupBy(posReturns.orderId)
        : [];
      const returnedByOrder = new Map(returnTotals.map(row => [row.orderId, Number(row.amount)]));
      const tiers = await tx.select().from(memberTiers).orderBy(memberTiers.sortOrder);
      let memberPoints = 0;
      let memberTotalSpend = 0;
      let memberTierId = initialTier.id;
      let totalPointsEarned = 0;

      for (const order of linkedOrders) {
        const returnedSpend = calculateReturnSpendTarget({
          orderSubtotal: Number(order.subtotal),
          orderTotal: Number(order.total),
          cumulativeRefund: returnedByOrder.get(order.id) ?? 0,
        });
        const eligibleSubtotal = Math.max(0, Number(order.subtotal) - returnedSpend);
        const reward = calculateMembershipOrderReward({
          subtotal: eligibleSubtotal,
          currentPoints: memberPoints,
          currentTotalSpend: memberTotalSpend,
          currentTierId: memberTierId,
          tiers,
        });
        memberPoints = reward.points;
        memberTotalSpend = reward.totalSpend;
        memberTierId = reward.tierId;
        totalPointsEarned += reward.pointsEarned;

        await tx.update(orders)
          .set({ pointsEarned: reward.pointsEarned })
          .where(eq(orders.id, order.id));
        await tx.insert(pointsLedger).values({
          membershipId,
          orderId: order.id,
          delta: reward.pointsEarned,
          reason: 'order_earn',
        });
      }

      if (linkedOrders.length > 0) {
        await tx.update(memberships).set({
          points: memberPoints,
          totalSpend: memberTotalSpend,
          tierId: memberTierId,
        }).where(eq(memberships.id, membershipId));
      }

      await tx.update(posCustomerLeads).set({
        status: 'activated',
        claimedUserId: userId,
        activationTokenHash: null,
        activationExpiresAt: null,
      }).where(and(
        eq(posCustomerLeads.id, lead.id),
        eq(posCustomerLeads.status, 'pending'),
      ));

      return {
        success: true,
        email,
        phone: lead.phone,
        welcomeVoucherCount: campaigns.length,
        linkedOrderCount: linkedOrders.length,
        pointsEarned: totalPointsEarned,
      } as const;
    });
  } catch (error) {
    const dbError = error as { code?: string; errno?: number };
    if (dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062) {
      return { success: false, error: 'Email atau nomor telepon sudah terdaftar' };
    }
    throw error;
  }
}
