// lib/xendit.ts — Xendit SDK wrapper

import Xendit from 'xendit-node';

interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  orderId?: number;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  invoiceDuration?: number; // seconds, default 24h
}

interface CreateInvoiceResult {
  id: string;
  invoiceUrl: string;
  expiryDate: string;
}

let _client: Xendit | null = null;
function getClient() {
  if (_client) return _client;
  const secretKey = process.env.XENDIT_SECRET_KEY;
  if (!secretKey) throw new Error('XENDIT_SECRET_KEY is not configured');
  _client = new Xendit({ secretKey });
  return _client;
}

export async function createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
  const client = getClient();
  // Use APP_URL for browser redirects (localhost), not BASE_URL (ngrok) which is for webhooks
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const result = await client.Invoice.createInvoice({
    data: {
      externalId: params.externalId,
      amount: params.amount,
      payerEmail: params.payerEmail,
      description: params.description,
      successRedirectUrl: params.successRedirectUrl || (params.orderId ? `${baseUrl}/orders/${params.orderId}` : `${baseUrl}/orders`),
      failureRedirectUrl: params.failureRedirectUrl || (params.orderId ? `${baseUrl}/orders/${params.orderId}` : `${baseUrl}/orders`),
      invoiceDuration: params.invoiceDuration ?? 86400, // 24 hours
    },
  });

  return {
    id: result.id!,
    invoiceUrl: result.invoiceUrl!,
    expiryDate: String(result.expiryDate),
  };
}

export async function getInvoice(invoiceId: string) {
  const client = getClient();
  return await client.Invoice.getInvoiceById({ invoiceId });
}

export async function expireInvoice(invoiceId: string): Promise<void> {
  const client = getClient();
  try {
    await client.Invoice.expireInvoice({ invoiceId });
  } catch (error: any) {
    // Treat already-expired as success
    if (error.message?.includes('ALREADY_EXPIRED')) return;
    throw error;
  }
}
