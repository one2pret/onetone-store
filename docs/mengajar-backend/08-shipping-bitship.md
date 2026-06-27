# Sesi 08 — Shipping API (Bitship/Biteship)

> ⏱️ Estimasi: 45 menit
> 🎯 Tujuan: Peserta bisa integrasi Bitship untuk cek ongkir, cetak resi, dan track pengiriman.

---

## 1. Konsep (10 menit)

### Bitship (Biteship)
- API aggregator kurir Indonesia
- Support: JNE, J&T, SiCepat, Pos Indonesia, AnterAja, dan instant courier (GoSend, GrabExpress, Lalamove)
- Satu API call untuk semua kurir
- Sandbox gratis untuk dev

### Flow Shipping
```
1. Customer pilih alamat → kita kirim koordinat origin + destination ke Bitship
2. Bitship return list rates (JNE REG, J&T EZ, dll) dengan harga + estimasi
3. Customer pilih kurir → simpan di order
4. Setelah bayar (status = packing), admin klik "Kirim" → POST ke Bitship
5. Bitship return tracking_id + waybill
6. Bitship kirim webhook saat status berubah (picked, on transit, delivered)
7. Status `delivered` → auto-update order ke `delivered`
```

---

## 2. Setup Bitship Account

1. Daftar di https://biteship.com
2. Login ke dashboard
3. Buka `Settings → API Keys` → copy **Test API Key**
4. Set di `.env.local`:
   ```
   BITSHIP_API_URL=https://api.biteship.com
   BITSHIP_API_KEY=biteship_test_xxx
   ```

---

## 3. Library Wrapper

Buat `lib/bitship.ts`:

```typescript
const BITSHIP_API_URL = process.env.BITSHIP_API_URL!;
const BITSHIP_API_KEY = process.env.BITSHIP_API_KEY!;

async function bitshipFetch(path: string, options: RequestInit = {}) {
  const url = `${BITSHIP_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: BITSHIP_API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Bitship API error");
  }
  return data;
}

// 1. Cek ongkir
export async function getShippingRates(params: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  items: Array<{
    name: string;
    description?: string;
    value: number; // harga
    length?: number;
    width?: number;
    height?: number;
    weight: number; // gram
    quantity: number;
  }>;
  couriers?: string; // "jne,jnt,sicepat"
}) {
  const body = {
    origin_latitude: params.originLat,
    origin_longitude: params.originLng,
    destination_latitude: params.destLat,
    destination_longitude: params.destLng,
    couriers: params.couriers || "jne,jnt,sicepat,anteraja,pos",
    items: params.items.map((item) => ({
      name: item.name,
      description: item.description ?? item.name,
      value: item.value,
      length: item.length ?? 10,
      width: item.width ?? 10,
      height: item.height ?? 10,
      weight: item.weight,
      quantity: item.quantity,
    })),
  };

  const result = await bitshipFetch("/v1/rates/couriers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return result.pricing as Array<{
    courier_code: string;
    courier_name: string;
    courier_service_code: string;
    courier_service_name: string;
    type: string; // "regular", "express", "economy"
    description: string;
    duration: string; // "1-2 days"
    price: number;
    company: string;
  }>;
}

// 2. Buat order shipping
export async function createShipment(params: {
  origin: {
    contactName: string;
    contactPhone: string;
    address: string;
    latitude: number;
    longitude: number;
    postalCode: number;
  };
  destination: {
    contactName: string;
    contactPhone: string;
    address: string;
    latitude: number;
    longitude: number;
    postalCode: number;
  };
  courier: {
    company: string; // "jne"
    type: string;    // "reg"
  };
  items: Array<{
    name: string;
    value: number;
    weight: number;
    quantity: number;
  }>;
  orderNote?: string;
}) {
  const body = {
    origin_contact_name: params.origin.contactName,
    origin_contact_phone: params.origin.contactPhone,
    origin_address: params.origin.address,
    origin_latitude: params.origin.latitude,
    origin_longitude: params.origin.longitude,
    origin_postal_code: params.origin.postalCode,

    destination_contact_name: params.destination.contactName,
    destination_contact_phone: params.destination.contactPhone,
    destination_address: params.destination.address,
    destination_latitude: params.destination.latitude,
    destination_longitude: params.destination.longitude,
    destination_postal_code: params.destination.postalCode,

    courier_company: params.courier.company,
    courier_type: params.courier.type,
    courier_insurance: 0,

    delivery_type: "now",
    order_note: params.orderNote ?? "",

    items: params.items,
  };

  const result = await bitshipFetch("/v1/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return result;
}

// 3. Track shipment
export async function getTracking(trackingId: string) {
  return await bitshipFetch(`/v1/trackings/${trackingId}`);
}
```

---

## 4. Server Action: `calculateShippingRates`

Buat `app/actions/shipping.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { cartItems, addresses, storeSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getShippingRates } from "@/lib/bitship";

export async function calculateShippingRates(addressId: number) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = Number(session.user.id);

  // 1. Ambil cart
  const cart = await db.query.cartItems.findMany({
    where: eq(cartItems.userId, userId),
    with: { product: true },
  });

  if (cart.length === 0) {
    return { success: false, error: "Cart kosong" };
  }

  // 2. Ambil alamat destination
  const address = await db.query.addresses.findFirst({
    where: eq(addresses.id, addressId),
  });
  if (!address || address.userId !== userId) {
    return { success: false, error: "Alamat tidak valid" };
  }

  // 3. Ambil store origin dari store_settings
  const settings = await db.select().from(storeSettings);
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const originLat = Number(settingsMap.origin_latitude);
  const originLng = Number(settingsMap.origin_longitude);

  // 4. Call Bitship
  try {
    const rates = await getShippingRates({
      originLat,
      originLng,
      destLat: Number(address.latitude),
      destLng: Number(address.longitude),
      items: cart.map((item) => ({
        name: item.product.name,
        value: Number(item.product.price),
        weight: item.product.weight ?? 500,
        quantity: item.quantity,
      })),
    });

    // Group by type (express/regular/economy) — UX better
    const grouped = {
      express: rates.filter((r) => r.type === "express"),
      regular: rates.filter((r) => r.type === "regular"),
      economy: rates.filter((r) => r.type === "economy"),
    };

    return { success: true, data: { rates, grouped } };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

---

## 5. Server Action: `sendOrderToBitship` (Admin)

Saat order status = `packing`, admin klik "Kirim ke Kurir":

```typescript
import { orders, shippings } from "@/lib/db/schema";
import { createShipment } from "@/lib/bitship";

export async function sendOrderToBitship(orderId: number) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, error: "Forbidden" };
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });

  if (!order) return { success: false, error: "Order tidak ditemukan" };
  if (order.status !== "packing") {
    return { success: false, error: "Order belum siap dikirim" };
  }

  // Ambil store settings
  const settings = await db.select().from(storeSettings);
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]));

  // Ambil shipping info yang dipilih saat checkout (simpan saat createOrder)
  const existingShipping = await db.query.shippings.findFirst({
    where: eq(shippings.orderId, orderId),
  });

  if (!existingShipping?.courierCompany || !existingShipping.courierType) {
    return { success: false, error: "Info kurir tidak ditemukan" };
  }

  try {
    const shipmentResult = await createShipment({
      origin: {
        contactName: s.store_name,
        contactPhone: s.store_phone,
        address: s.store_address,
        latitude: Number(s.origin_latitude),
        longitude: Number(s.origin_longitude),
        postalCode: Number(s.origin_postal_code ?? "11530"),
      },
      destination: {
        contactName: order.shippingName,
        contactPhone: order.shippingPhone,
        address: order.shippingAddress,
        latitude: 0, // ambil dari order.shippingLat (perlu tambah kolom)
        longitude: 0,
        postalCode: 0,
      },
      courier: {
        company: existingShipping.courierCompany,
        type: existingShipping.courierType,
      },
      items: order.items.map((item) => ({
        name: item.productName,
        value: Number(item.price),
        weight: 500,
        quantity: item.quantity,
      })),
      orderNote: `Order ${order.orderNumber}`,
    });

    // Update shipping record
    await db.update(shippings).set({
      trackingId: shipmentResult.id,
      waybillId: shipmentResult.courier?.waybill_id,
      status: "confirmed",
    }).where(eq(shippings.id, existingShipping.id));

    // Update order ke shipping
    await db.update(orders).set({
      status: "shipping",
      shippingAt: new Date(),
    }).where(eq(orders.id, orderId));

    await db.insert(orderStatusLogs).values({
      orderId,
      fromStatus: "packing",
      toStatus: "shipping",
      changedBy: `admin:${session.user.id}`,
      note: `Bitship ID: ${shipmentResult.id}`,
    });

    revalidatePath(`/dashboard/orders/${orderId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

---

## 6. Webhook Handler: Bitship Status Update

Buat `app/api/webhooks/bitship/route.ts`:

```typescript
import { db } from "@/lib/db";
import { shippings, shippingHistories, orders, orderStatusLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { restoreStock } from "@/lib/stock";

export async function POST(request: Request) {
  const body = await request.json();
  console.log("[Bitship Webhook]", body);

  const { order_id, status, courier_waybill_id, note } = body;

  // Cari shipping by trackingId (= order_id Bitship)
  const shipping = await db.query.shippings.findFirst({
    where: eq(shippings.trackingId, order_id),
    with: { order: { with: { items: true } } },
  });

  if (!shipping) {
    return Response.json({ message: "Shipping not found" });
  }

  // Update shipping status
  await db.update(shippings).set({
    status,
    waybillId: courier_waybill_id ?? shipping.waybillId,
  }).where(eq(shippings.id, shipping.id));

  // Insert history
  await db.insert(shippingHistories).values({
    shippingId: shipping.id,
    status,
    note,
  });

  const order = shipping.order;

  // Handle delivered
  if (status === "delivered" && order.status === "shipping") {
    await db.update(orders).set({
      status: "delivered",
      deliveredAt: new Date(),
    }).where(eq(orders.id, order.id));

    await db.insert(orderStatusLogs).values({
      orderId: order.id,
      fromStatus: "shipping",
      toStatus: "delivered",
      changedBy: "webhook:bitship",
    });
  }

  // Handle cancel/returned/rejected
  if (["cancelled", "returned", "rejected"].includes(status)) {
    if (order.status !== "cancelled" && order.status !== "delivered") {
      await db.update(orders).set({
        status: "cancelled",
        cancelledAt: new Date(),
      }).where(eq(orders.id, order.id));

      // Restore stock
      for (const item of order.items) {
        if (item.productId) {
          await restoreStock(item.productId, item.quantity);
        }
      }

      await db.insert(orderStatusLogs).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "cancelled",
        changedBy: "webhook:bitship",
        note: `Shipping ${status}`,
      });
    }
  }

  return Response.json({ message: "OK" });
}
```

### Setup Webhook URL di Bitship Dashboard
1. Login Bitship
2. Settings → Webhooks
3. URL: `https://your-ngrok.ngrok.app/api/webhooks/bitship`
4. Subscribe: order status updates

---

## 7. Get Tracking (Customer)

```typescript
// app/actions/orders.ts
import { getTracking } from "@/lib/bitship";

export async function getOrderTracking(orderId: number) {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { shippings: true },
  });

  if (!order || order.userId !== Number(session.user.id)) {
    return { success: false, error: "Forbidden" };
  }

  const shipping = order.shippings[0];
  if (!shipping?.trackingId) {
    return { success: false, error: "Belum ada tracking" };
  }

  try {
    const tracking = await getTracking(shipping.trackingId);
    return { success: true, data: tracking };
  } catch (err) {
    return { success: false, error: "Gagal mengambil tracking" };
  }
}
```

---

## 8. UI Component (Optional Bonus)

### ShippingOptions Component (Customer)
Tampilkan rates di checkout:

```tsx
"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/utils";

type Rate = {
  courier_code: string;
  courier_name: string;
  courier_service_name: string;
  type: string;
  duration: string;
  price: number;
};

export function ShippingOptions({
  rates,
  onSelect,
}: {
  rates: { express: Rate[]; regular: Rate[]; economy: Rate[] };
  onSelect: (rate: Rate) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {(["express", "regular", "economy"] as const).map((type) => (
        rates[type].length > 0 && (
          <div key={type}>
            <h4 className="font-semibold capitalize">{type}</h4>
            <div className="space-y-2 mt-2">
              {rates[type].map((rate) => {
                const id = `${rate.courier_code}-${rate.courier_service_name}`;
                return (
                  <label
                    key={id}
                    className="flex justify-between p-3 border rounded-lg cursor-pointer hover:border-[#51B1A6]"
                  >
                    <div className="flex gap-3 items-start">
                      <input
                        type="radio"
                        name="courier"
                        checked={selected === id}
                        onChange={() => {
                          setSelected(id);
                          onSelect(rate);
                        }}
                      />
                      <div>
                        <p className="font-medium">
                          {rate.courier_name} — {rate.courier_service_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Estimasi: {rate.duration}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold">{formatRupiah(rate.price)}</p>
                  </label>
                );
              })}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
```

---

## ✅ Checklist Akhir Sesi 08

- [ ] `lib/bitship.ts` (rates, createShipment, getTracking)
- [ ] `calculateShippingRates()` jalan, return list rates
- [ ] `sendOrderToBitship()` dari admin → buat shipment
- [ ] Order auto-update ke `shipping` setelah send
- [ ] Webhook handler delivered → order `delivered`
- [ ] Tracking bisa di-fetch customer

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `Invalid API key` | Pakai test key, double-check di env |
| `No rates available` | Koordinat origin/dest tidak valid. Test pakai Jakarta → Bandung. |
| `Item weight too low` | Min weight 500g. Default fallback di kode. |
| Webhook tidak masuk | Setup ngrok + subscribe di Bitship dashboard |

---

## 📚 Referensi
- Bitship Docs: https://biteship.com/id/docs
- Sandbox Setup: https://biteship.com/id/docs/intro/getting-started
- Rates API: https://biteship.com/id/docs/api/rates

---

## ➡️ Lanjut ke [Sesi 09 — Testing](./09-testing.md)
