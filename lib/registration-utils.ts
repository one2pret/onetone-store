export function normalizeIndonesianPhone(value?: string): string | null {
  if (!value?.trim()) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export type LoginIdentifier =
  | { type: 'email'; value: string }
  | { type: 'phone'; value: string };

const INTERNAL_CUSTOMER_EMAIL_DOMAIN = 'noemail.onetone.invalid';

export function createInternalCustomerEmail(phone: string): string {
  return `customer.${phone}@${INTERNAL_CUSTOMER_EMAIL_DOMAIN}`;
}

export function isInternalCustomerEmail(email?: string | null): boolean {
  return email?.endsWith(`@${INTERNAL_CUSTOMER_EMAIL_DOMAIN}`) ?? false;
}

export function normalizeLoginIdentifier(value?: string): LoginIdentifier | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? { type: 'email', value: email }
      : null;
  }
  const phone = normalizeIndonesianPhone(trimmed);
  return phone ? { type: 'phone', value: phone } : null;
}

export function calculateGrantExpiry(
  grantedAt: Date,
  validDays: number | null,
  campaignEndsAt: Date | null,
): Date | null {
  const relativeExpiry = validDays && validDays > 0
    ? new Date(grantedAt.getTime() + validDays * 24 * 60 * 60 * 1000)
    : null;
  if (!relativeExpiry) return campaignEndsAt;
  if (!campaignEndsAt) return relativeExpiry;
  return relativeExpiry < campaignEndsAt ? relativeExpiry : campaignEndsAt;
}
