import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueMemberQrCode, verifyMemberQrCode } from "@/lib/member-qr";

describe("member QR", () => {
  const previousSecret = process.env.AUTH_SECRET;

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-member-qr-secret-at-least-32-characters";
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  });

  it("issues a stable signed code without contact data", () => {
    const code = issueMemberQrCode(41);
    expect(code).toMatch(/^otm1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    expect(code).not.toContain("email");
    expect(code).not.toContain("628");
    expect(verifyMemberQrCode(code)).toBe(41);
    expect(issueMemberQrCode(41)).toBe(code);
  });

  it("rejects malformed, tampered, and differently signed codes", () => {
    const code = issueMemberQrCode(41);
    expect(verifyMemberQrCode("not-a-member-code")).toBeNull();
    expect(verifyMemberQrCode(`${code.slice(0, -1)}${code.endsWith("a") ? "b" : "a"}`)).toBeNull();

    process.env.AUTH_SECRET = "different-member-qr-secret-at-least-32-chars";
    expect(verifyMemberQrCode(code)).toBeNull();
  });

  it("rejects invalid user identifiers", () => {
    expect(() => issueMemberQrCode(0)).toThrow("Invalid member user id");
    expect(() => issueMemberQrCode(Number.NaN)).toThrow("Invalid member user id");
  });
});
