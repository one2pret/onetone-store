/** Sandbox order lifecycle is controlled by the atomic, validated Xendit
 * Invoice webhook. Legacy actions do not have compatible stock accounting.
 */
export function isSandboxOrder(orderNumber: string | null | undefined): boolean {
  return typeof orderNumber === 'string' && orderNumber.startsWith('SBX-');
}

export const SANDBOX_LEGACY_BLOCKED_MESSAGE =
  'Order sandbox TEST harus diproses oleh alur khusus. Jangan gunakan pembatalan, bayar ulang, status manual, atau pengiriman legacy sebelum UAT terkait selesai.';
