"use server";

import { requirePosOperator } from "@/lib/pos-auth";
import { getEligiblePosMemberVouchers, type PosMemberVoucher } from "@/lib/pos-vouchers";
import { z } from "zod";

const requestSchema = z.object({
  customerUserId: z.number().int().positive(),
  subtotal: z.number().finite().nonnegative(),
});

export async function getPosMemberVouchers(input: {
  customerUserId: number;
  subtotal: number;
}): Promise<{ success: true; data: PosMemberVoucher[] } | { success: false; error: string }> {
  const authResult = await requirePosOperator();
  if (!authResult.ok) return { success: false, error: authResult.error };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Permintaan voucher tidak valid" };
  const data = await getEligiblePosMemberVouchers(parsed.data.customerUserId, parsed.data.subtotal);
  return { success: true, data };
}
