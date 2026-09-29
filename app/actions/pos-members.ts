"use server";

import { db } from "@/lib/db";
import {
  memberships,
  memberTiers,
  posCustomerLeads,
  posSessions,
  users,
} from "@/lib/db/schema";
import { requirePosOperator } from "@/lib/pos-auth";
import { normalizeIndonesianPhone } from "@/lib/registration-utils";
import { issuePosLeadActivationToken } from "@/lib/pos-lead-activation-token";
import { and, eq, isNull, like, or } from "drizzle-orm";
import { z } from "zod";

const searchSchema = z.string().trim().min(2).max(100);
const registerLeadSchema = z.object({
  sessionId: z.number().int().positive(),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(255),
  phone: z.string().trim().min(8, "Nomor telepon tidak valid").max(30),
  email: z.union([z.string().trim().email("Email tidak valid").max(255), z.literal("")]).optional(),
  consent: z.literal(true, { message: "Persetujuan pelanggan wajib dicatat" }),
  marketingConsent: z.boolean().default(false),
});

export type PosMemberSearchResult = {
  id: number;
  name: string;
  maskedEmail: string;
  maskedPhone: string | null;
  tierName: string;
  points: number;
};

export type PosCustomerLeadResult = {
  id: number;
  name: string;
  maskedPhone: string;
  maskedEmail: string | null;
  status: "pending";
  activationPath: string;
  activationExpiresAt: string;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

function maskEmail(value: string) {
  const [localPart, domain] = value.split("@");
  if (!domain) return value;
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"•".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

function maskPhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}

export async function searchPosMembers(query: string): Promise<
  | { success: true; data: PosMemberSearchResult[] }
  | { success: false; error: string }
> {
  const authResult = await requirePosOperator();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const parsed = searchSchema.safeParse(query);
  if (!parsed.success) {
    return { success: false, error: "Masukkan minimal 2 karakter" };
  }

  const value = parsed.data;
  const textPattern = `%${escapeLike(value.toLowerCase())}%`;
  const phone = normalizeIndonesianPhone(value);
  const phoneDigits = value.replace(/\D/g, "");
  const phonePattern = phone
    ? `%${escapeLike(phone)}%`
    : phoneDigits.length >= 3
      ? `%${escapeLike(phoneDigits)}%`
      : null;

  const searchCondition = or(
    like(users.name, textPattern),
    like(users.email, textPattern),
    phonePattern ? like(users.phone, phonePattern) : undefined,
  );

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      tierName: memberTiers.name,
      points: memberships.points,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(memberTiers, eq(memberTiers.id, memberships.tierId))
    .where(and(
      eq(users.role, "customer"),
      isNull(users.deletedAt),
      searchCondition,
    ))
    .limit(8);

  return {
    success: true,
    data: rows.map(row => ({
      id: row.id,
      name: row.name,
      maskedEmail: maskEmail(row.email),
      maskedPhone: maskPhone(row.phone),
      tierName: row.tierName,
      points: row.points ?? 0,
    })),
  };
}

export async function registerPosCustomerLead(input: {
  sessionId: number;
  name: string;
  phone: string;
  email?: string;
  consent: true;
  marketingConsent?: boolean;
}): Promise<
  | { success: true; kind: "member"; member: PosMemberSearchResult }
  | { success: true; kind: "lead"; lead: PosCustomerLeadResult; reused: boolean }
  | { success: false; error: string }
> {
  const authResult = await requirePosOperator();
  if (!authResult.ok) return { success: false, error: authResult.error };

  const parsed = registerLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Data calon member tidak valid" };
  }

  const phoneNormalized = normalizeIndonesianPhone(parsed.data.phone);
  if (!phoneNormalized) return { success: false, error: "Nomor telepon tidak valid" };
  const email = parsed.data.email?.trim().toLowerCase() || null;

  const sessionRows = await db
    .select({ id: posSessions.id, locationId: posSessions.locationId })
    .from(posSessions)
    .where(and(
      eq(posSessions.id, parsed.data.sessionId),
      eq(posSessions.cashierId, authResult.actor.id),
      eq(posSessions.status, "open"),
    ))
    .limit(1);
  const session = sessionRows[0];
  if (!session?.locationId) {
    return { success: false, error: "Sesi POS aktif atau lokasi stok tidak ditemukan" };
  }

  const existingMembers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      tierName: memberTiers.name,
      points: memberships.points,
    })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(memberTiers, eq(memberTiers.id, memberships.tierId))
    .where(and(
      eq(users.role, "customer"),
      isNull(users.deletedAt),
      or(
        eq(users.phone, phoneNormalized),
        email ? eq(users.email, email) : undefined,
      ),
    ))
    .limit(1);

  if (existingMembers[0]) {
    const member = existingMembers[0];
    return {
      success: true,
      kind: "member",
      member: {
        id: member.id,
        name: member.name,
        maskedEmail: maskEmail(member.email),
        maskedPhone: maskPhone(member.phone),
        tierName: member.tierName,
        points: member.points ?? 0,
      },
    };
  }

  const existingLeads = await db
    .select({
      id: posCustomerLeads.id,
      email: posCustomerLeads.email,
      marketingConsentAt: posCustomerLeads.marketingConsentAt,
      claimedUserId: posCustomerLeads.claimedUserId,
      status: posCustomerLeads.status,
    })
    .from(posCustomerLeads)
    .where(eq(posCustomerLeads.phoneNormalized, phoneNormalized))
    .limit(1);
  const existingLead = existingLeads[0];

  if (existingLead?.claimedUserId || existingLead?.status === "activated") {
    return { success: false, error: "Nomor ini sudah diaktivasi. Cari sebagai member yang sudah terdaftar." };
  }

  const now = new Date();
  const activation = issuePosLeadActivationToken(now);
  if (existingLead) {
    await db.update(posCustomerLeads).set({
      name: parsed.data.name,
      email: email ?? existingLead.email,
      status: "pending",
      consentAt: now,
      marketingConsentAt: parsed.data.marketingConsent ? now : existingLead.marketingConsentAt,
      createdByUserId: authResult.actor.id,
      locationId: session.locationId,
      activationTokenHash: activation.tokenHash,
      activationExpiresAt: activation.expiresAt,
    }).where(eq(posCustomerLeads.id, existingLead.id));

    return {
      success: true,
      kind: "lead",
      reused: true,
      lead: {
        id: existingLead.id,
        name: parsed.data.name,
        maskedPhone: maskPhone(phoneNormalized) ?? "••••",
        maskedEmail: email ? maskEmail(email) : existingLead.email ? maskEmail(existingLead.email) : null,
        status: "pending",
        activationPath: `/member/activate/${activation.token}`,
        activationExpiresAt: activation.expiresAt.toISOString(),
      },
    };
  }

  try {
    const inserted = await db.insert(posCustomerLeads).values({
      name: parsed.data.name,
      phoneNormalized,
      email,
      status: "pending",
      consentAt: now,
      marketingConsentAt: parsed.data.marketingConsent ? now : null,
      source: "pos",
      createdByUserId: authResult.actor.id,
      locationId: session.locationId,
      activationTokenHash: activation.tokenHash,
      activationExpiresAt: activation.expiresAt,
    }).$returningId();
    const leadId = inserted[0]?.id;
    if (!leadId) return { success: false, error: "Gagal menyimpan calon member" };

    return {
      success: true,
      kind: "lead",
      reused: false,
      lead: {
        id: leadId,
        name: parsed.data.name,
        maskedPhone: maskPhone(phoneNormalized) ?? "••••",
        maskedEmail: email ? maskEmail(email) : null,
        status: "pending",
        activationPath: `/member/activate/${activation.token}`,
        activationExpiresAt: activation.expiresAt.toISOString(),
      },
    };
  } catch (error) {
    const dbError = error as { code?: string; errno?: number };
    if (dbError.code === "ER_DUP_ENTRY" || dbError.errno === 1062) {
      return { success: false, error: "Nomor ini baru saja didaftarkan. Cari ulang sebelum melanjutkan." };
    }
    throw error;
  }
}
