# Sesi 07 — Payment Gateway Xendit

> ⏱️ Estimasi: 45 menit
> 🎯 Tujuan: Peserta bisa integrasi Xendit untuk terima pembayaran — generate invoice, handle webhook, update order ke "packing" otomatis.

---

## 1. Konsep (10 menit)

### Xendit
- Payment gateway Indonesia (mirip Stripe untuk Indonesia)
- Support: QRIS, Virtual Account (BCA, BNI, Mandiri, dll), E-wallet (OVO, DANA, ShopeePay, GoPay), Retail (Alfamart, Indomaret), Kartu Kredit
- **Sandbox mode**: gratis, ada test number untuk simulasi pembayaran

### Flow Pembayaran
```
1. User checkout → createOrder() → create Xendit invoice
2. Response: invoice URL → redirect user ke URL
3. User bayar di Xendit page (QRIS, VA, dll)
4. Xendit kirim webhook ke kita: "Invoice PAID"
5. Kita verify webhook → update order ke "packing"
6. Customer notif: pembayaran berhasil
```

### Penting
- Webhook **TIDAK BISA** dipercaya pakai data dari client — selalu verify token
- Idempotent: webhook bisa dikirim 2x — handle dengan cek status sekarang sebelum update

---

## 2. Setup Xendit Account

1. Buka https://dashboard.xendit.co/register
2. Daftar akun (mode test/development)
3. Buka Menu **Settings → API Keys**
4. Copy **Test Secret Key** (format: `xnd_development_xxx`)
5. Set di `.env.local`:
   ```
   XENDIT_SECRET_KEY=xnd_development_xxx
   XENDIT_WEBHOOK_TOKEN=verification-token-abc123
   ```

> ⚠️ **JANGAN PAKAI PRODUCTION KEY** saat development.

---

## 3. Setup Xendit SDK

Sudah install `xendit-node` di Sesi 01. Bikin wrapper `lib/xendit.ts`:

```typescript
import { Xendit } from "xendit-node";

const xenditClient = new Xendit({
  secretKey: process.env.XENDIT_SECRET_KEY!,
});

export const { Invoice } = xenditClient;

// Helper: create invoice
export async function createXenditInvoice(params: {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
}) {
  const invoice = await Invoice.createInvoice({
    data: {
      externalId: params.externalId,
      amount: params.amount,
      payerEmail: params.payerEmail,
      description: params.description,
      successRedirectUrl: params.successRedirectUrl,
      failureRedirectUrl: params.failureRedirectUrl,
      invoiceDuration: 86400, // 24 jam (detik)
    },
  });

  return invoice;
}

// Helper: expire invoice
export async function expireXenditInvoice(invoiceId: string) {
  return await Invoice.expireInvoice({ invoiceId });
}
```

---

## 4. Integrasi `createOrder` dengan Xendit

Update `app/actions/orders.ts` (bagian yang dikomentari di Sesi 06):

```typescript
import { createXenditInvoice } from "@/lib/xendit";
import { invoices } from "@/lib/db/schema";

// Di dalam createOrder, setelah insert order & items:

// 9. Create Xendit invoice
let invoiceUrl: string | null = null;
try {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const xenditInvoice = await createXenditInvoice({
    externalId: orderNumber, // pakai orderNumber sebagai external_id
    amount: total,
    payerEmail: user!.email,
    description: `Pembayaran order ${orderNumber}`,
    successRedirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${orderId}`,
    failureRedirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${orderId}`,
  });

  invoiceUrl = xenditInvoice.invoiceUrl!;

  // Simpan ke invoices table
  await db.insert(invoices).values({
    orderId,
    xenditId: xenditInvoice.id,
    invoiceUrl,
    amount: String(total),
    status: "pending",
  });
} catch (err) {
  console.error("Xendit error:", err);
  return { success: false, error: "Gagal membuat invoice pembayaran" };
}

return { success: true, orderId, orderNumber, paymentUrl: invoiceUrl };
```

### Redirect User ke Invoice URL
Di checkout form:
```typescript
const result = await createOrder(formData);
if (result.success && result.paymentUrl) {
  window.location.href = result.paymentUrl;
}
```

---

## 5. Webhook Handler: Pembayaran Sukses/Expired

Buat `app/api/webhooks/xendit/route.ts`:

```typescript
import { db } from "@/lib/db";
import { orders, invoices, orderStatusLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { restoreStock } from "@/lib/stock";

export async function POST(request: Request) {
  // 1. Verify token
  const callbackToken = request.headers.get("x-callback-token");
  if (callbackToken !== process.env.XENDIT_WEBHOOK_TOKEN) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await request.json();
  console.log("Xendit webhook:", body);

  const { external_id, status } = body;

  // 2. Cari order by orderNumber (= external_id)
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, external_id),
    with: { items: true, invoices: true },
  });

  if (!order) {
    // Selalu return 200 — Xendit akan retry kalau non-200
    return Response.json({ message: "Order not found" }, { status: 200 });
  }

  // 3. Handle PAID
  if (status === "PAID") {
    // Idempotency: skip kalau sudah packing
    if (order.status !== "waiting_payment") {
      return Response.json({ message: "Already processed" });
    }

    // Update order
    await db.update(orders).set({
      status: "packing",
      paidAt: new Date(),
      packingAt: new Date(),
    }).where(eq(orders.id, order.id));

    // Update invoice
    const invoice = order.invoices[0];
    if (invoice) {
      await db.update(invoices).set({
        status: "paid",
        paidAt: new Date(),
      }).where(eq(invoices.id, invoice.id));
    }

    // Audit log
    await db.insert(orderStatusLogs).values({
      orderId: order.id,
      fromStatus: "waiting_payment",
      toStatus: "packing",
      changedBy: "webhook:xendit",
      note: "Payment confirmed",
    });
  }

  // 4. Handle EXPIRED
  if (status === "EXPIRED") {
    if (order.status !== "waiting_payment") {
      return Response.json({ message: "Already processed" });
    }

    await db.update(orders).set({
      status: "expired",
      expiredAt: new Date(),
    }).where(eq(orders.id, order.id));

    const invoice = order.invoices[0];
    if (invoice) {
      await db.update(invoices).set({ status: "expired" })
        .where(eq(invoices.id, invoice.id));
    }

    // Restore stock
    for (const item of order.items) {
      if (item.productId) {
        await restoreStock(item.productId, item.quantity);
      }
    }

    await db.insert(orderStatusLogs).values({
      orderId: order.id,
      fromStatus: "waiting_payment",
      toStatus: "expired",
      changedBy: "webhook:xendit",
    });
  }

  return Response.json({ message: "OK" });
}
```

---

## 6. Setup Webhook URL di Xendit

### Dev: Pakai ngrok
Webhook butuh URL publik. Saat dev, pakai ngrok:

```bash
# Install ngrok
brew install ngrok

# Expose localhost
ngrok http 3000

# Copy URL: https://xxx-xxx.ngrok-free.app
```

### Konfigurasi di Xendit Dashboard
1. Buka `Settings → Webhooks → Invoice`
2. Tambah URL: `https://xxx.ngrok-free.app/api/webhooks/xendit`
3. Generate Verification Token → copy
4. Update `.env.local`:
   ```
   XENDIT_WEBHOOK_TOKEN=<token-dari-xendit>
   ```
5. Restart `pnpm dev`

---

## 7. Test Flow Pembayaran End-to-End

### Skenario: Bayar via QRIS Test
1. Login customer di web
2. Tambah produk ke cart, checkout
3. Pilih alamat, kurir (skip dulu kalau Bitship belum siap, pakai dummy cost)
4. Submit → redirect ke Xendit invoice page
5. Pilih **QRIS** → akan muncul QR code dummy
6. Klik **Simulate Payment** (di sandbox)
7. Xendit kirim webhook → cek terminal log Next.js
8. Order otomatis pindah ke `packing`
9. Cek di `/orders/[id]` — status sudah update

### Skenario: Invoice Expired
1. Buat order, biarkan
2. Setelah 24 jam (atau force expire via Xendit dashboard) → webhook EXPIRED
3. Order pindah ke `expired`, stock restored

### Manual Trigger Webhook (untuk test)
```bash
curl -X POST http://localhost:3000/api/webhooks/xendit \
  -H "x-callback-token: $XENDIT_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "ORD2606ABCD",
    "status": "PAID",
    "amount": 350000
  }'
```

---

## 8. Repay Flow (Order Expired)

Update `repayOrder` (Sesi 06) untuk generate invoice baru:

```typescript
export async function repayOrder(orderId: number) {
  // ... auth check & validasi status

  // Generate new Xendit invoice
  const user = await db.query.users.findFirst({
    where: eq(users.id, Number(session.user.id)),
  });

  const xenditInvoice = await createXenditInvoice({
    externalId: `${order.orderNumber}-${Date.now()}`, // unique
    amount: Number(order.total),
    payerEmail: user!.email,
    description: `Pembayaran ulang ${order.orderNumber}`,
  });

  await db.insert(invoices).values({
    orderId,
    xenditId: xenditInvoice.id,
    invoiceUrl: xenditInvoice.invoiceUrl!,
    amount: order.total,
    status: "pending",
  });

  // ... update order status + audit log

  return { success: true, paymentUrl: xenditInvoice.invoiceUrl };
}
```

---

## 9. Admin Cancel Order — Expire Invoice di Xendit

Saat admin cancel order yang `waiting_payment`, expire juga invoice:

```typescript
import { expireXenditInvoice } from "@/lib/xendit";

export async function cancelOrderByAdmin(orderId: number) {
  // ... auth check

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { invoices: true, items: true },
  });

  if (order.status === "waiting_payment") {
    // Expire invoice
    const invoice = order.invoices.find((i) => i.status === "pending");
    if (invoice?.xenditId) {
      try {
        await expireXenditInvoice(invoice.xenditId);
      } catch (err) {
        console.error("Failed to expire Xendit invoice:", err);
        // Tidak fatal — order tetap dibatalkan
      }
    }
  }

  // ... update order ke cancelled + restore stock + audit
}
```

---

## 10. Best Practices

### 1. Idempotency
Webhook bisa dikirim 2x. Selalu cek status saat ini sebelum update:
```typescript
if (order.status !== "waiting_payment") return Response.json({});
```

### 2. Always Return 200
Xendit retry kalau non-200. Return 200 walau order tidak ditemukan — log saja.

### 3. Log Webhook
Simpan webhook payload (atau hash) untuk debugging:
```typescript
console.log("[Xendit Webhook]", JSON.stringify(body));
```

### 4. Verify Token Selalu
JANGAN trust webhook tanpa verify `x-callback-token`. Tanpa ini, attacker bisa fake payment.

### 5. Test di Sandbox Dulu
Jangan masuk production sebelum test:
- Pembayaran sukses
- Pembayaran expired
- Webhook retry (matikan server saat webhook masuk, lihat retry)

---

## ✅ Checklist Akhir Sesi 07

- [ ] `lib/xendit.ts` (createInvoice, expireInvoice)
- [ ] `createOrder` auto-generate Xendit invoice
- [ ] Customer di-redirect ke Xendit invoice URL
- [ ] Webhook handler PAID → order pindah ke `packing`
- [ ] Webhook handler EXPIRED → order pindah ke `expired` + restore stock
- [ ] ngrok setup untuk dev webhook
- [ ] Test end-to-end: bayar simulasi QRIS → status berubah otomatis
- [ ] Repay flow generate invoice baru
- [ ] Admin cancel → expire Xendit invoice

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `401 Invalid token` di webhook | `x-callback-token` di Xendit dashboard belum sama dengan `.env` |
| Webhook tidak masuk | ngrok URL berubah — update di Xendit dashboard |
| `Xendit API key invalid` | Pakai sandbox key, bukan production |
| Order tetap waiting setelah simulate paid | Cek ngrok port = port Next.js dev |
| Invoice 2x untuk order yang sama | Belum cek `existing invoice` sebelum create — boleh tapi waste |
| Stock minus setelah refund | Lupa `restoreStock` di handler EXPIRED |

---

## 📚 Referensi
- Xendit Docs: https://docs.xendit.co
- Invoice API: https://docs.xendit.co/invoice
- Webhook Guide: https://docs.xendit.co/xenplatform/webhooks
- Test card numbers: https://docs.xendit.co/credit-cards/integrations/testing-scenarios

---

## ➡️ Lanjut ke [Sesi 08 — Shipping API Bitship](./08-shipping-bitship.md)
