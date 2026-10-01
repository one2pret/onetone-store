import { createHash, randomBytes } from 'node:crypto';

export const POS_LEAD_ACTIVATION_MINUTES = 30;

export function hashPosLeadActivationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function isValidPosLeadActivationToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function issuePosLeadActivationToken(now = new Date()) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashPosLeadActivationToken(token),
    expiresAt: new Date(now.getTime() + POS_LEAD_ACTIVATION_MINUTES * 60 * 1000),
  };
}
