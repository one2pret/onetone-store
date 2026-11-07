/** Pure checks for a customer-visible order and the legacy Xendit synchronizer.
 *
 * The sandbox state machine is exclusively managed by its validated webhook.
 * The older page-load sync path is not transactional and must not touch SBX-.
 */
export function canReadOrderDetail(args: {
  requesterId: number;
  requesterRole: string | null | undefined;
  orderUserId: number | null | undefined;
}): boolean {
  if (!Number.isSafeInteger(args.requesterId) || args.requesterId <= 0) return false;
  if (args.requesterRole === 'admin') return true;
  return args.orderUserId != null && args.orderUserId === args.requesterId;
}

export function canUseLegacyXenditOrderSync(orderNumber: string): boolean {
  return !orderNumber.startsWith('SBX-');
}
