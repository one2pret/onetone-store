'use server';

import { z } from 'zod';
import { activatePosCustomerLead as activateLead } from '@/lib/pos-lead-activation';

const activationSchema = z.object({
  token: z.string().trim().min(1),
  email: z.string().trim().email('Email tidak valid').max(255),
  password: z.string().min(8, 'Password minimal 8 karakter').max(72, 'Password maksimal 72 karakter'),
  passwordConfirmation: z.string(),
}).refine(data => data.password === data.passwordConfirmation, {
  path: ['passwordConfirmation'],
  message: 'Konfirmasi password tidak sama',
});

export type PosLeadActivationState = {
  success: boolean;
  error?: string;
  errors?: {
    email?: string[];
    password?: string[];
    passwordConfirmation?: string[];
  };
  email?: string;
  welcomeVoucherCount?: number;
  linkedOrderCount?: number;
  pointsEarned?: number;
};

export async function activatePosLead(
  _previousState: PosLeadActivationState,
  formData: FormData,
): Promise<PosLeadActivationState> {
  const parsed = activationSchema.safeParse({
    token: formData.get('token'),
    email: formData.get('email'),
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      errors: {
        email: errors.email,
        password: errors.password,
        passwordConfirmation: errors.passwordConfirmation,
      },
    };
  }

  const result = await activateLead({
    token: parsed.data.token,
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (!result.success) {
    return result.field
      ? { success: false, errors: { [result.field]: [result.error] } }
      : { success: false, error: result.error };
  }

  return {
    success: true,
    email: result.email,
    welcomeVoucherCount: result.welcomeVoucherCount,
    linkedOrderCount: result.linkedOrderCount,
    pointsEarned: result.pointsEarned,
  };
}
