import { NextResponse } from 'next/server';
import { sandboxOrderEnabled } from '@/lib/checkout/sandbox-order-policy';
import { validCallbackToken } from '@/lib/checkout/sandbox-xendit-webhook';
import { handleSandboxInvoiceCallback } from '@/lib/checkout/handle-sandbox-invoice-callback';

/** Optional direct sandbox callback URL retained for backward compatibility.
 * Xendit Test Mode can instead use the existing /api/webhooks/xendit, which
 * dispatches validated SBX- invoices to the same handler.
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
  return handleSandboxInvoiceCallback(body);
}
