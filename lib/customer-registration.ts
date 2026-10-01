import bcrypt from 'bcryptjs';
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { memberships, memberTiers, users, userVouchers, vouchers } from '@/lib/db/schema';
import { calculateGrantExpiry, createInternalCustomerEmail, normalizeIndonesianPhone } from '@/lib/registration-utils';

export type CustomerRegistrationInput = {
  name: string;
  email?: string;
  password: string;
  phone: string;
};

export type CustomerRegistrationResult =
  | { success: true; user: { id: number; name: string; email: string | null; phone: string }; welcomeVoucherGranted: boolean }
  | { success: false; field?: 'email' | 'phone'; error: string };

export async function createCustomerAccount(
  input: CustomerRegistrationInput,
): Promise<CustomerRegistrationResult> {
  const suppliedEmail = input.email?.trim().toLowerCase() || null;
  const suppliedPhone = input.phone.trim();
  const phone = normalizeIndonesianPhone(suppliedPhone);
  if (!phone) {
    return { success: false, field: 'phone', error: 'Nomor telepon tidak valid' };
  }
  const storedEmail = suppliedEmail ?? createInternalCustomerEmail(phone);

  const password = await bcrypt.hash(input.password, 10);
  const grantedAt = new Date();

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx.select({ id: users.id, email: users.email, phone: users.phone })
        .from(users)
        .where(suppliedEmail
          ? or(eq(users.email, suppliedEmail), eq(users.phone, phone))
          : eq(users.phone, phone))
        .limit(1);
      if (existing.length > 0) {
        return suppliedEmail && existing[0].email.toLowerCase() === suppliedEmail
          ? { success: false, field: 'email', error: 'Email sudah terdaftar' } as const
          : { success: false, field: 'phone', error: 'Nomor telepon sudah terdaftar' } as const;
      }

      const inserted = await tx.insert(users).values({
        name: input.name.trim(),
        email: storedEmail,
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
        user: { id: userId, name: input.name.trim(), email: suppliedEmail, phone },
        welcomeVoucherGranted: campaigns.length > 0,
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
