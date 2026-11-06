import { NextResponse } from 'next/server';
import { sandboxOrderEnabled } from '@/lib/checkout/sandbox-order-policy';
import {
  parseSandboxInvoiceEvent,
  validCallbackToken,
} from '@/lib/checkout/sandbox-xendit-webhook';
import {
  processSandboxInvoiceEvent,
  SandboxWebhookRejected,
} from '@/lib/checkout/process-sandbox-webhook';

/** Exclusive callback for legacy Xendit Invoice API in staging.
 * Only accepts SBX- invoice IDs, never modifies ordinary web orders.
 * Do not point the LIVE Xendit dashboard to this endpoint.
 */
export async function POST(request: Request) {
  if (!sandboxOrderEnabled(
    process.env.CHECKOUT_SANDBOX_ORDER_ENABLED,
    process.env.XENDIT_SECRET_KEY,
  )) {
    return NextResponse.json({ success: false, error: 'Not available' }, { status: 404 });
  }

  const configuredToken = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!configuredToken) {
    console.error('Sandbox Xendit webhook token is not configured');
    return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 503 });
  }
  if (!validCallbackToken(request.headers.get('x-callback-token'), configuredToken)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = parseSandboxInvoiceEvent(body);
  if (parsed.kind === 'ignored') {
    return NextResponse.json({ success: true, message: 'Unsupported invoice status ignored' });
  }
  if (parsed.kind !== 'event') {
    return NextResponse.json({ success: false, error: 'Invalid sandbox invoice callback' }, { status: 422 });
  }

  try {
    const result = await processSandboxInvoiceEvent(parsed.event);
    if (result.decision === 'conflict') {
      // Late PAID after expiry (or EXPIRED after PAID) cannot safely reverse
      // fulfillment or stock. Acknowledge to prevent endless retries, but flag
      // for operator-led reconciliation in server logs.
      console.error('Sandbox Xendit conflicting callback requires reconciliation', {
        orderId: result.orderId, status: parsed.event.status,
      });
      return NextResponse.json({
        success: true, code: 'manual_reconciliation_required',
        message: 'Callback acknowledged; conflicting terminal state requires review',
      });
    }
    return NextResponse.json({
      success: true, result: result.decision,
      orderId: result.orderId,
    });
  } catch (error) {
    if (error instanceof SandboxWebhookRejected) {
      console.error('Sandbox Xendit callback rejected', {
        status: error.status, message: error.message,
      });
      return NextResponse.json({
        success: false, error: error.message,
      }, { status: error.status });
    }
    console.error('Sandbox Xendit callback processing failed', error);
    // Non-2xx response asks Xendit to retry rather than silently lose event.
    return NextResponse.json({ success: false, error: 'Temporary webhook failure' }, { status: 503 });
  }
}
