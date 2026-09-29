import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRows = vi.fn();
const mockRequirePosOperator = vi.fn();
const mockInsertedValue = vi.fn();
const mockUpdatedValue = vi.fn();

function mockSelectChain() {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockImplementation(() => Promise.resolve(mockRows()));
  return chain;
}

function mockInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn((value: unknown) => {
    mockInsertedValue(value);
    return chain;
  });
  chain.$returningId = vi.fn().mockResolvedValue([{ id: 71 }]);
  return chain;
}

function mockUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn((value: unknown) => {
    mockUpdatedValue(value);
    return chain;
  });
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => mockSelectChain()),
    insert: vi.fn(() => mockInsertChain()),
    update: vi.fn(() => mockUpdateChain()),
  },
}));

vi.mock("@/lib/pos-auth", () => ({
  requirePosOperator: (...args: unknown[]) => mockRequirePosOperator(...args),
}));

import { registerPosCustomerLead, searchPosMembers } from "@/app/actions/pos-members";
import { hashPosLeadActivationToken } from "@/lib/pos-lead-activation-token";

describe("POS member search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePosOperator.mockResolvedValue({
      ok: true,
      actor: { id: 2, name: "Kasir A", role: "cashier" },
    });
    mockRows.mockReturnValue([]);
  });

  it("requires an authenticated POS operator", async () => {
    mockRequirePosOperator.mockResolvedValueOnce({ ok: false, error: "Akses POS ditolak" });

    await expect(searchPosMembers("Rina")).resolves.toEqual({
      success: false,
      error: "Akses POS ditolak",
    });
    expect(mockRows).not.toHaveBeenCalled();
  });

  it("rejects a search shorter than two characters", async () => {
    await expect(searchPosMembers("R")).resolves.toEqual({
      success: false,
      error: "Masukkan minimal 2 karakter",
    });
    expect(mockRows).not.toHaveBeenCalled();
  });

  it("returns limited member identity with masked contact data", async () => {
    mockRows.mockReturnValueOnce([{
      id: 41,
      name: "Rina Member",
      email: "rina@example.com",
      phone: "6281234567890",
      tierName: "Gold",
      points: 1250,
    }]);

    const result = await searchPosMembers("08123");

    expect(result).toEqual({
      success: true,
      data: [{
        id: 41,
        name: "Rina Member",
        maskedEmail: "ri•••@example.com",
        maskedPhone: "•••• 7890",
        tierName: "Gold",
        points: 1250,
      }],
    });
  });

  it("registers a normalized pending lead with cashier and location audit", async () => {
    mockRows
      .mockReturnValueOnce([{ id: 10, locationId: 7 }])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);

    const result = await registerPosCustomerLead({
      sessionId: 10,
      name: "Rina Baru",
      phone: "0812-3456-7890",
      email: "RINA@EXAMPLE.COM",
      consent: true,
      marketingConsent: false,
    });

    expect(result).toMatchObject({
      success: true,
      kind: "lead",
      reused: false,
      lead: { id: 71, name: "Rina Baru", maskedPhone: "•••• 7890", status: "pending" },
    });
    if (!result.success || result.kind !== "lead") throw new Error("Expected a lead result");
    const rawToken = result.lead.activationPath.split("/").at(-1);
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mockInsertedValue).toHaveBeenCalledWith(expect.objectContaining({
      phoneNormalized: "6281234567890",
      email: "rina@example.com",
      status: "pending",
      source: "pos",
      createdByUserId: 2,
      locationId: 7,
      marketingConsentAt: null,
      activationTokenHash: hashPosLeadActivationToken(rawToken!),
      activationExpiresAt: expect.any(Date),
    }));
    expect(JSON.stringify(mockInsertedValue.mock.calls)).not.toContain(rawToken);
  });

  it("returns an existing member instead of creating a duplicate lead", async () => {
    mockRows
      .mockReturnValueOnce([{ id: 10, locationId: 7 }])
      .mockReturnValueOnce([{
        id: 41,
        name: "Rina Member",
        email: "rina@example.com",
        phone: "6281234567890",
        tierName: "Gold",
        points: 1250,
      }]);

    const result = await registerPosCustomerLead({
      sessionId: 10,
      name: "Nama Input Kasir",
      phone: "081234567890",
      consent: true,
    });

    expect(result).toMatchObject({ success: true, kind: "member", member: { id: 41 } });
    expect(mockInsertedValue).not.toHaveBeenCalled();
    expect(mockUpdatedValue).not.toHaveBeenCalled();
  });

  it("reuses a pending lead for the same normalized phone", async () => {
    mockRows
      .mockReturnValueOnce([{ id: 10, locationId: 7 }])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{
        id: 71,
        email: null,
        marketingConsentAt: null,
        claimedUserId: null,
        status: "pending",
      }]);

    const result = await registerPosCustomerLead({
      sessionId: 10,
      name: "Rina Diperbarui",
      phone: "+62 812 3456 7890",
      consent: true,
      marketingConsent: true,
    });

    expect(result).toMatchObject({ success: true, kind: "lead", reused: true, lead: { id: 71 } });
    expect(mockUpdatedValue).toHaveBeenCalledWith(expect.objectContaining({
      name: "Rina Diperbarui",
      status: "pending",
      createdByUserId: 2,
      locationId: 7,
      marketingConsentAt: expect.any(Date),
      activationTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      activationExpiresAt: expect.any(Date),
    }));
    expect(mockInsertedValue).not.toHaveBeenCalled();
  });
});
