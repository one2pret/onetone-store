'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export async function getMyProfile() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = Number(session.user.id);
  return db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .then((r) => r[0] ?? null);
}

const profileSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  phone: z.string().optional(),
});

type ProfileState = { success: boolean; error?: string; errors?: Record<string, string[]> };

export async function updateProfile(
  prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const validated = profileSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  const userId = Number(session.user.id);
  await db
    .update(users)
    .set({ name: validated.data.name, phone: validated.data.phone ?? null })
    .where(eq(users.id, userId));

  revalidatePath('/account');
  revalidatePath('/account/profile');

  return { success: true };
}
