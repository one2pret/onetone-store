import { createHmac, timingSafeEqual } from "node:crypto";

const MEMBER_QR_VERSION = "otm1";
const USER_ID_PATTERN = /^[1-9]\d{0,9}$/;

function memberQrSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to issue or verify member QR codes");
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", memberQrSecret()).update(payload).digest("base64url");
}

export function issueMemberQrCode(userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid member user id");
  const encodedId = Buffer.from(String(userId), "utf8").toString("base64url");
  const payload = `${MEMBER_QR_VERSION}.${encodedId}`;
  return `${payload}.${signature(payload)}`;
}

export function verifyMemberQrCode(code: string): number | null {
  const parts = code.trim().split(".");
  if (parts.length !== 3 || parts[0] !== MEMBER_QR_VERSION) return null;
  const [version, encodedId, suppliedSignature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(encodedId) || !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature)) return null;

  const expected = signature(`${version}.${encodedId}`);
  const suppliedBuffer = Buffer.from(suppliedSignature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;

  try {
    const decoded = Buffer.from(encodedId, "base64url").toString("utf8");
    if (!USER_ID_PATTERN.test(decoded)) return null;
    const userId = Number(decoded);
    return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}
