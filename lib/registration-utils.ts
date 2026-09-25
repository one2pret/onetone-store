export function normalizeIndonesianPhone(value?: string): string | null {
  if (!value?.trim()) return null;
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
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
