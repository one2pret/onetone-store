import bcrypt from 'bcryptjs';
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { memberships, memberTiers, users, userVouchers, vouchers } from '@/lib/db/schema';
import { calculateGrantExpiry, normalizeIndonesianPhone } from '@/lib/registration-utils';

export type CustomerRegistrationInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

export type CustomerRegistrationResult =
  | { success: true; user: { id: number; name: string; email: string }; welcomeVoucherGranted: boolean }
  | { success: false; field?: 'email' | 'phone'; error: string };

export async function createCustomerAccount(
  input: CustomerRegistrationInput,
): Promise<CustomerRegistrationResult> {
  const email = input.email.trim().toLowerCase();
  const suppliedPhone = input.phone?.trim() ?? '';
  const phone = normalizeIndonesianPhone(suppliedPhone);
  if (suppliedPhone && !phone) {
    return { success: false, field: 'phone', error: 'Nomor telepon tidak valid' };
  }

  const password = await bcrypt.hash(input.password, 10);
  const grantedAt = new Date();

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing.length > 0) {
        return { success: false, field: 'email', error: 'Email sudah terdaftar' } as const;
      }

      const inserted = await tx.insert(users).values({
        name: input.name.trim(),
        email,
        password,
        phone,
        role: 'customer',
      }).$returningId();
      const userId = inserted[0]?.id;
      if (!userId) throw new Error('USER_INSERT_FAILED');

      const [initialTier] = await tx.select({ id: memberTiers.id })
        .from(memberTiers)
        .orderBy(asc(memberTiers.minSpend))
        .limit(1);
      if (!initialTier) throw new Error('INITIAL_TIER_NOT_CONFIGURED');

      await tx.insert(memberships).values({ userId, tierId: initialTier.id });

      const campaigns = await tx.select().from(vouchers).where(and(
        eq(vouchers.audience, 'new_user'),
        eq(vouchers.isActive, true),
        or(isNull(vouchers.startsAt), lte(vouchers.startsAt, grantedAt)),
        or(isNull(vouchers.endsAt), gte(vouchers.endsAt, grantedAt)),
      ));

      for (const campaign of campaigns) {
        await tx.insert(userVouchers).values({
          userId,
          voucherId: campaign.id,
          grantedAt,
          expiresAt: calculateGrantExpiry(
            grantedAt,
            campaign.validDaysAfterGrant,
            campaign.endsAt ? new Date(campaign.endsAt) : null,
          ),
        });
      }

      return {
        success: true,
        user: { id: userId, name: input.name.trim(), email },
        welcomeVoucherGranted: campaigns.length > 0,
      } as const;
    });
  } catch (error) {
    const dbError = error as { code?: string; errno?: number };
    if (dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062) {
      return { success: false, field: 'email', error: 'Email sudah terdaftar' };
    }
    throw error;
  }
}
