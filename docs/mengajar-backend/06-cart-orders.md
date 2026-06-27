# Sesi 06 — Cart & Order Flow

> ⏱️ Estimasi: 60 menit
> 🎯 Tujuan: Peserta paham flow end-to-end checkout — dari cart → create order → manage status → audit log.

---

## 1. Konsep (10 menit)

### Order Status Machine
```
                 ┌── expired ──┐ (repay)
                 │             │
waiting_payment ─┼── packing ──┼──> shipping ──> delivered ✓ (terminal)
                 │             │
                 └── cancelled │ (non-terminal → cancelled)
                               └──> cancelled ✗ (terminal)
```

### Aturan Penting
1. **Snapshot di order_items**: simpan `productName`, `price` saat checkout — supaya order history utuh meski produk diubah.
2. **Snapshot alamat di orders**: `shippingName`, `shippingAddress` — sama alasan.
3. **Stock deduction saat checkout**: kurangi stock saat order dibuat, restore saat cancel/expired.
4. **Audit log**: setiap status change masuk ke `order_status_logs`.
5. **Expiry**: order `waiting_payment` punya `willExpiredAt` (24 jam). Cron job set ke `expired`.

---

## 2. Helper: Order Status Validation

Buat `lib/order-status.ts`:

```typescript
export const ORDER_STATUSES = [
  "waiting_payment", "packing", "shipping",
  "delivered", "expired", "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  waiting_payment: ["packing", "expired", "cancelled"],
  packing: ["shipping", "cancelled"],
  shipping: ["delivered", "cancelled"],
  delivered: [],
  expired: ["waiting_payment"], // repay
  cancelled: [],
};

export function validateStatusTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStatuses(current: OrderStatus): OrderStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  waiting_payment: "Menunggu Pembayaran",
  packing: "Dikemas",
  shipping: "Dikirim",
  delivered: "Selesai",
  expired: "Expired",
  cancelled: "Dibatalkan",
};
```

---

## 3. Helper: Stock Management

Buat `lib/stock.ts`:

```typescript
import { db } from "./db";
import { products } from "./db/schema";
import { eq, sql } from "drizzle-orm";

export async function deductStock(productId: number, qty: number) {
  await db
    .update(products)
    .set({ stock: sql`${products.stock} - ${qty}` })
    .where(eq(products.id, productId));
}

export async function restoreStock(productId: number, qty: number) {
  await db
    .update(products)
    .set({ stock: sql`${products.stock} + ${qty}` })
    .where(eq(products.id, productId));
}

export async function validateStock(productId: number, qty: number) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
  });
  if (!product) throw new Error("Produk tidak ditemukan");
  if ((product.stock ?? 0) < qty) {
    throw new Error(`Stok ${product.name} tidak cukup`);
  }
  return product;
}
```

---

## 4. Helper: Order Number Generator

Tambah di `lib/utils.ts`:

```typescript
export function generateOrderNumber(): string {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD${yy}${mm}${dd}${random}`;
}
// Output: ORD2606ABCD
```

---

## 5. Server Action: `createOrder`

Buat `app/actions/orders.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import {
  orders, orderItems, cartItems, products,
  invoices, orderStatusLogs,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/utils";
import { validateStock, deductStock } from "@/lib/stock";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createOrderSchema = z.object({
  addressId: z.coerce.number().int().positive(),
  shippingCourier: z.string().min(1),
  shippingType: z.string().min(1),
  shippingCost: z.coerce.number().min(0),
  shippingEstimate: z.string().optional(),
});

export async function createOrder(
  prevState: unknown,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }
  const userId = Number(session.user.id);

  const validated = createOrderSchema.safeParse({
    addressId: formData.get("addressId"),
    shippingCourier: formData.get("shippingCourier"),
    shippingType: formData.get("shippingType"),
    shippingCost: formData.get("shippingCost"),
    shippingEstimate: formData.get("shippingEstimate"),
  });

  if (!validated.success) {
    return { success: false, error: "Data checkout tidak lengkap" };
  }

  // 1. Ambil cart items
  const cart = await db.query.cartItems.findMany({
    where: eq(cartItems.userId, userId),
    with: { product: true },
  });

  if (cart.length === 0) {
    return { success: false, error: "Cart kosong" };
  }

  // 2. Validate stock semua item
  try {
    for (const item of cart) {
      await validateStock(item.productId, item.quantity);
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }

  // 3. Ambil alamat
  const address = await db.query.addresses.findFirst({
    where: eq(addresses.id, validated.data.addressId),
  });
  if (!address || address.userId !== userId) {
    return { success: false, error: "Alamat tidak valid" };
  }

  // 4. Hitung total
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );
  const total = subtotal + validated.data.shippingCost;

  const orderNumber = generateOrderNumber();
  const willExpiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

  // 5. Insert order
  const [orderResult] = await db.insert(orders).values({
    userId,
    orderNumber,
    status: "waiting_payment",
    subtotal: String(subtotal),
    shippingCost: String(validated.data.shippingCost),
    total: String(total),
    shippingName: address.recipientName,
    shippingPhone: address.phone,
    shippingAddress: `${address.address}, ${address.district}, ${address.city}, ${address.province} ${address.postalCode}`,
    willExpiredAt,
  }).$returningId();

  const orderId = orderResult.id;

  // 6. Insert order items + deduct stock
  for (const item of cart) {
    await db.insert(orderItems).values({
      orderId,
      productId: item.productId,
      productName: item.product.name,
      productImage: item.product.image,
      price: item.product.price,
      quantity: item.quantity,
      subtotal: String(Number(item.product.price) * item.quantity),
    });
    await deductStock(item.productId, item.quantity);
  }

  // 7. Audit log
  await db.insert(orderStatusLogs).values({
    orderId,
    fromStatus: null,
    toStatus: "waiting_payment",
    changedBy: `user:${userId}`,
    note: "Order created",
  });

  // 8. Clear cart
  await db.delete(cartItems).where(eq(cartItems.userId, userId));

  // 9. Create Xendit invoice (Sesi 07)
  // const invoice = await createInvoice({...});
  // simpan ke invoices table
  // redirect ke invoice.invoiceUrl

  revalidatePath("/orders");
  return { success: true, orderId, orderNumber };
}
```

> **Note**: bagian Xendit dikomentari dulu — akan dilengkapi di [Sesi 07](./07-payment-xendit.md).

---

## 6. Server Action: `changeOrderStatus` (Admin)

```typescript
import { validateStatusTransition, type OrderStatus } from "@/lib/order-status";

export async function changeOrderStatus(
  orderId: number,
  newStatus: OrderStatus
) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, error: "Forbidden" };
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!order) return { success: false, error: "Order tidak ditemukan" };

  // Validate transition
  if (!validateStatusTransition(order.status, newStatus)) {
    return {
      success: false,
      error: `Tidak bisa pindah dari ${order.status} ke ${newStatus}`,
    };
  }

  // Update + timestamp
  const timestampField = `${newStatus.replace("_", "")}At`; // paidAt, etc.
  await db.update(orders).set({
    status: newStatus,
    [timestampField]: new Date(),
  }).where(eq(orders.id, orderId));

  // Audit log
  await db.insert(orderStatusLogs).values({
    orderId,
    fromStatus: order.status,
    toStatus: newStatus,
    changedBy: `admin:${session.user.id}`,
  });

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
  return { success: true };
}
```

---

## 7. Server Action: `cancelOrderByCustomer`

Customer hanya bisa cancel saat `waiting_payment`:

```typescript
import { restoreStock } from "@/lib/stock";

export async function cancelOrderByCustomer(orderId: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });

  if (!order) return { success: false, error: "Order tidak ditemukan" };
  if (order.userId !== Number(session.user.id)) {
    return { success: false, error: "Forbidden" };
  }
  if (order.status !== "waiting_payment") {
    return { success: false, error: "Order tidak bisa dibatalkan" };
  }

  // Update status
  await db.update(orders).set({
    status: "cancelled",
    cancelledAt: new Date(),
  }).where(eq(orders.id, orderId));

  // Restore stock
  for (const item of order.items) {
    if (item.productId) {
      await restoreStock(item.productId, item.quantity);
    }
  }

  // Audit
  await db.insert(orderStatusLogs).values({
    orderId,
    fromStatus: "waiting_payment",
    toStatus: "cancelled",
    changedBy: `user:${session.user.id}`,
    note: "Cancelled by customer",
  });

  revalidatePath("/orders");
  return { success: true };
}
```

---

## 8. Server Action: `repayOrder`

Untuk order yang expired, customer bisa bayar ulang:

```typescript
export async function repayOrder(orderId: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });

  if (!order) return { success: false, error: "Order tidak ditemukan" };
  if (order.userId !== Number(session.user.id)) {
    return { success: false, error: "Forbidden" };
  }
  if (order.status !== "expired") {
    return { success: false, error: "Order tidak dalam status expired" };
  }

  // Reset status + new expiry
  const willExpiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.update(orders).set({
    status: "waiting_payment",
    willExpiredAt,
    expiredAt: null,
  }).where(eq(orders.id, orderId));

  // TODO: create new Xendit invoice (Sesi 07)

  await db.insert(orderStatusLogs).values({
    orderId,
    fromStatus: "expired",
    toStatus: "waiting_payment",
    changedBy: `user:${session.user.id}`,
    note: "Repay",
  });

  revalidatePath("/orders");
  return { success: true };
}
```

---

## 9. Cron: Auto-Expire Orders

Buat `app/api/cron/check-expired-orders/route.ts`:

```typescript
import { db } from "@/lib/db";
import { orders, orderStatusLogs } from "@/lib/db/schema";
import { eq, lt, and } from "drizzle-orm";
import { restoreStock } from "@/lib/stock";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find expired
  const now = new Date();
  const expired = await db.query.orders.findMany({
    where: and(
      eq(orders.status, "waiting_payment"),
      lt(orders.willExpiredAt, now)
    ),
    with: { items: true },
  });

  for (const order of expired) {
    await db.update(orders).set({
      status: "expired",
      expiredAt: now,
    }).where(eq(orders.id, order.id));

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
      changedBy: "cron:system",
    });
  }

  return Response.json({ success: true, expiredCount: expired.length });
}
```

### Schedule Cron
Pakai Vercel Cron, GitHub Actions, atau external (cron-job.org):
```bash
# Setiap 5 menit
*/5 * * * * curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/cron/check-expired-orders
```

---

## 10. API: Create Order (Flutter)

Buat `app/api/orders/route.ts` (POST):

```typescript
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  // Logic sama dengan server action createOrder
  // ... (refactor jadi shared function)

  return Response.json({ success: true, data: { orderId, orderNumber, paymentUrl } });
}
```

> 💡 Best practice: extract logic checkout ke shared function (`lib/order-service.ts`) lalu panggil dari Server Action & API route.

---

## 11. Live Test Flow End-to-End

1. Login sebagai customer
2. Tambah produk ke cart (`POST /api/cart`)
3. Buka cart (`GET /api/cart`) — pastikan ada
4. Create order via server action atau API
5. Cek di `/orders` — muncul dengan status `waiting_payment`
6. Cek `order_items` di Drizzle Studio — snapshot benar
7. Cek `products.stock` — sudah berkurang
8. Cancel order → cek status & stock restored

---

## ✅ Checklist Akhir Sesi 06

- [ ] `lib/order-status.ts` (status machine)
- [ ] `lib/stock.ts` (deduct/restore/validate)
- [ ] `createOrder()` jalan, audit log masuk
- [ ] `changeOrderStatus()` validasi transition
- [ ] `cancelOrderByCustomer()` restore stock
- [ ] `repayOrder()` reset ke waiting_payment
- [ ] Cron endpoint `check-expired-orders` jalan
- [ ] Test end-to-end OK

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| Stock minus | Lupa `validateStock` sebelum `deductStock` |
| Transition error | Cek `VALID_TRANSITIONS` di status machine |
| Order tetap waiting setelah bayar | Webhook Xendit belum di-handle (Sesi 07) |
| Cart tidak ke-clear | Lupa `db.delete(cartItems)` setelah create order |
| Total salah hitung | Lupa parse `Number(product.price)` (price = string decimal) |

---

## ➡️ Lanjut ke [Sesi 07 — Payment Gateway Xendit](./07-payment-xendit.md)
