async function main() {
  const [apply, actorId, orderId, ownerId, attemptId, invoiceId, approvalRef, ...extra] = process.argv.slice(2);
  if (apply !== '--apply-reviewed' || !approvalRef || extra.length !== 0) {
    console.error('Usage: --apply-reviewed <actorId> <orderId> <ownerId> <attemptId> <invoiceId> <approvalRef>');
    return 2;
  }
  try {
    const { recoverSandboxVoucherInvoice } = await import('@/lib/checkout/reconcile-sandbox-voucher-invoice');
    const result = await recoverSandboxVoucherInvoice({
      actorId: Number(actorId), orderId: Number(orderId), ownerId: Number(ownerId),
      attemptId: Number(attemptId), invoiceId, approvalRef,
    });
    console.info('sandbox_invoice_recovery', result);
    return 0;
  } catch {
    console.error('sandbox_invoice_recovery', { outcome: 'blocked' });
    return 1;
  }
}

void main().then(code => process.exit(code));
