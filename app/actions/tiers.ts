// app/actions/tiers.ts
'use server';

import { db } from '@/lib/db';
import { memberTiers, memberships } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const tierSchema = z.object({
  name: z.string().min(1),
  minSpend: z.coerce.number().int().min(0),
  discountPct: z.coerce.number().int().min(0).max(100),
  pointMultiplier: z.coerce.number().int().min(1),
  freeShippingThreshold: z.coerce.number().int().min(0).nullable(),
});

export async function getAllTiers() {
  return db.select().from(memberTiers).orderBy(memberTiers.sortOrder);
}

export async function updateTier(id: number, prevState: any, formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== 'admin') return { success: false, error: 'Unauthorized' };

  const raw = {
    name: formData.get('name'),
    minSpend: formData.get('min_spend'),
    discountPct: formData.get('discount_pct'),
    pointMultiplier: formData.get('point_multiplier'),
    freeShippingThreshold: formData.get('free_shipping_threshold') || null,
  };

  const validated = tierSchema.safeParse(raw);
  if (!validated.success) return { success: false, error: 'Data tidak valid' };

  await db.update(memberTiers).set(validated.data).where(eq(memberTiers.id, id));

  revalidatePath('/dashboard/settings/tiers');
  return { success: true };
}

export async function overrideMemberTier(userId: number, tierId: number) {
  const session = await auth();
  if (session?.user?.role !== 'admin') return { success: false, error: 'Unauthorized' };

  await db.update(memberships)
    .set({ tierId })
    .where(eq(memberships.userId, userId));

  revalidatePath(`/dashboard/members/${userId}`);
  return { success: true };
}
