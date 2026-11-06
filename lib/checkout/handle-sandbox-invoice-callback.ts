import { NextResponse } from 'next/server';
import { parseSandboxInvoiceEvent } from './sandbox-xendit-webhook';
import {
  processSandboxInvoiceEvent,
  SandboxWebhookRejected,
} from './process-sandbox-webhook';

/**
 * Handle a body received through either authenticated Xendit Invoice URL.
 * Callers MUST validate x-callback-token and sandbox feature gates first.
 * The processor independently verifies matching stored invoice ID, order
 * number and amount under a database transaction before changing any state.
 */
export async function handleSandboxInvoiceCallback(body: unknown) {
  const parsed = parseSandboxInvoiceEvent(body);
  if (parsed.kind === 'ignored') {
    return NextResponse.json({
      success: true,
      message: 'Unsupported sandbox invoice status ignored',
    });
  }
  if (parsed.kind !== 'event') {
    return NextResponse.json({
      success: false,
      error: 'Invalid sandbox invoice callback',
    }, { status: 422 });
  }

  try {
    const result = await processSandboxInvoiceEvent(parsed.event);
    if (result.decision === 'conflict') {
      // PAID after expiry or EXPIRED after PAID must never silently reverse
      // stock/fulfillment. Operator must reconcile with provider.
      console.error('Sandbox Xendit conflicting callback requires reconciliation', {
        orderId: result.orderId, status: parsed.event.status,
      });
      return NextResponse.json({
        success: true,
        code: 'manual_reconciliation_required',
        message: 'Callback acknowledged; terminal state requires review',
      });
    }
    return NextResponse.json({
      success: true,
      result: result.decision,
      orderId: result.orderId,
    });
  } catch (error) {
    if (error instanceof SandboxWebhookRejected) {
      console.error('Sandbox invoice callback rejected', {
        status: error.status, message: error.message,
      });
      return NextResponse.json({
        success: false, error: error.message,
      }, { status: error.status });
    }
    console.error('Sandbox invoice callback processing failed', error);
    // A non-2xx result requests an automatic provider retry.
    return NextResponse.json({
      success: false, error: 'Temporary webhook failure',
    }, { status: 503 });
  }
}
