# Sesi 09 — Testing (Vitest)

> ⏱️ Estimasi: 30 menit
> 🎯 Tujuan: Peserta paham unit testing dengan Vitest, bisa test util functions, server actions, dan API routes.

---

## 1. Konsep (5 menit)

### Kenapa Test?
- **Confidence** saat refactor — tahu mana yang break
- **Documentation** — test = spec yang executable
- **Bug prevention** — catch regression sebelum production

### Test Pyramid
```
        /\
       /E2E\       ← Mahal, lambat (Playwright/Cypress)
      /------\
     /  API   \    ← Test endpoint via real HTTP
    /----------\
   /  Integ.   \   ← Multi-module, dengan mock DB
  /------------\
 /    Unit     \   ← Cepat, fokus 1 function (sebagian besar test)
/--------------\
```

### Stack
- **Vitest** — test runner cepat (mirip Jest, native ESM)
- **Testing Library** — test React component (jarang dipakai di backend)
- **jsdom** — fake browser environment

---

## 2. Setup Vitest

### Install
Sudah installed di Sesi 01. Recap:
```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

### Buat `vitest.config.ts`
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

### Buat `tests/setup.ts`
```typescript
import "@testing-library/jest-dom/vitest";

// Mock env vars
process.env.AUTH_SECRET = "test-secret-min-32-chars-abcdefg";
process.env.XENDIT_SECRET_KEY = "xnd_test";
process.env.XENDIT_WEBHOOK_TOKEN = "test-token";
process.env.BITSHIP_API_URL = "https://test.biteship.com";
process.env.BITSHIP_API_KEY = "biteship_test";
process.env.CRON_SECRET = "cron-test";
```

### Tambah Script di `package.json`
```json
"test": "vitest",
"test:run": "vitest run"
```

---

## 3. Fixtures

Buat `tests/helpers/fixtures.ts`:

```typescript
import type { Product, Category, User, Order, OrderItem, CartItem, Address } from "@/lib/db/schema";

export const sampleCategory: Category = {
  id: 1,
  name: "Elektronik",
  slug: "elektronik",
  description: null,
  image: null,
  createdAt: new Date(),
};

export const sampleProduct: Product = {
  id: 1,
  categoryId: 1,
  name: "Earbuds Pro",
  slug: "earbuds-pro",
  description: "Earbuds wireless",
  price: "299000.00",
  stock: 50,
  weight: 200,
  image: null,
  isActive: true,
  isFeatured: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const sampleUser: User = {
  id: 2,
  name: "John Doe",
  email: "john@example.com",
  password: "$2a$10$hashedpassword",
  phone: "081234567890",
  role: "customer",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const sampleAdmin: User = {
  ...sampleUser,
  id: 1,
  email: "admin@store.com",
  role: "admin",
};

export const sampleOrder: Order = {
  id: 1,
  userId: 2,
  orderNumber: "ORD2606ABCD",
  status: "waiting_payment",
  subtotal: "299000.00",
  shippingCost: "15000.00",
  total: "314000.00",
  shippingName: "John Doe",
  shippingPhone: "081234567890",
  shippingAddress: "Jl. Test No. 1",
  willExpiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  paidAt: null,
  packingAt: null,
  shippingAt: null,
  deliveredAt: null,
  expiredAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

---

## 4. Unit Test: Utils

Buat `tests/unit/utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatRupiah, formatDate, generateOrderNumber } from "@/lib/utils";

describe("formatRupiah", () => {
  it("should format number to Rupiah", () => {
    expect(formatRupiah(299000)).toMatch(/Rp\s?299\.000/);
  });

  it("should handle string input", () => {
    expect(formatRupiah("299000.00")).toMatch(/Rp\s?299\.000/);
  });

  it("should handle zero", () => {
    expect(formatRupiah(0)).toMatch(/Rp\s?0/);
  });
});

describe("generateOrderNumber", () => {
  it("should start with ORD prefix", () => {
    const num = generateOrderNumber();
    expect(num).toMatch(/^ORD\d{6}[A-Z0-9]{4}$/);
  });

  it("should be unique on consecutive calls", () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    expect(a).not.toBe(b);
  });
});
```

### Run
```bash
pnpm test:run tests/unit/utils.test.ts
```

Output:
```
✓ tests/unit/utils.test.ts (6)
  ✓ formatRupiah (3)
  ✓ generateOrderNumber (2)
```

---

## 5. Unit Test: Order Status

Buat `tests/unit/order-status.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateStatusTransition, getNextStatuses } from "@/lib/order-status";

describe("validateStatusTransition", () => {
  it("should allow waiting_payment → packing", () => {
    expect(validateStatusTransition("waiting_payment", "packing")).toBe(true);
  });

  it("should allow packing → shipping", () => {
    expect(validateStatusTransition("packing", "shipping")).toBe(true);
  });

  it("should reject delivered → packing", () => {
    expect(validateStatusTransition("delivered", "packing")).toBe(false);
  });

  it("should reject shipping → waiting_payment", () => {
    expect(validateStatusTransition("shipping", "waiting_payment")).toBe(false);
  });

  it("should allow expired → waiting_payment (repay)", () => {
    expect(validateStatusTransition("expired", "waiting_payment")).toBe(true);
  });
});

describe("getNextStatuses", () => {
  it("should return [packing, expired, cancelled] for waiting_payment", () => {
    const next = getNextStatuses("waiting_payment");
    expect(next).toContain("packing");
    expect(next).toContain("expired");
    expect(next).toContain("cancelled");
  });

  it("should return empty for delivered (terminal)", () => {
    expect(getNextStatuses("delivered")).toEqual([]);
  });
});
```

---

## 6. Mock Database

Pattern mock Drizzle untuk test server actions:

```typescript
// tests/actions/products.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sampleProduct } from "../helpers/fixtures";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      products: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation((url) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createProduct, getProducts } from "@/app/actions/products";

// Helper untuk chain query
function mockSelectChain(returnValue: unknown) {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = vi.fn().mockImplementation((cb: any) => cb(returnValue));
  return chain;
}

describe("getProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return list of products", async () => {
    (db.select as any).mockReturnValue(
      mockSelectChain([{ products: sampleProduct, categories: null }])
    );

    const result = await getProducts();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Earbuds Pro");
  });
});

describe("createProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject if not admin", async () => {
    (auth as any).mockResolvedValue({
      user: { id: "2", role: "customer" },
    });

    const formData = new FormData();
    formData.set("name", "Test");
    formData.set("price", "100");
    formData.set("stock", "10");
    formData.set("weight", "100");

    const result = await createProduct(null, formData);
    expect(result.success).toBe(false);
    expect(result.errors?._form?.[0]).toBe("Forbidden");
  });

  it("should validate required name", async () => {
    (auth as any).mockResolvedValue({
      user: { id: "1", role: "admin" },
    });

    const formData = new FormData();
    formData.set("name", ""); // kosong
    formData.set("price", "100");
    formData.set("stock", "10");
    formData.set("weight", "100");

    const result = await createProduct(null, formData);
    expect(result.success).toBe(false);
    expect(result.errors?.name).toBeDefined();
  });
});
```

---

## 7. Test API Route (Webhook)

Buat `tests/api/webhooks-xendit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/webhooks/xendit/route";
import { sampleOrder } from "../helpers/fixtures";

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      orders: { findFirst: vi.fn() },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { db } from "@/lib/db";

describe("POST /api/webhooks/xendit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 for invalid token", async () => {
    const req = new Request("http://localhost/api/webhooks/xendit", {
      method: "POST",
      headers: { "x-callback-token": "wrong" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should update order to packing on PAID", async () => {
    (db.query.orders.findFirst as any).mockResolvedValue({
      ...sampleOrder,
      items: [],
      invoices: [],
    });

    const req = new Request("http://localhost/api/webhooks/xendit", {
      method: "POST",
      headers: {
        "x-callback-token": process.env.XENDIT_WEBHOOK_TOKEN!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        external_id: "ORD2606ABCD",
        status: "PAID",
        amount: 314000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });
});
```

---

## 8. Test Bitship Wrapper (Mock fetch)

```typescript
// tests/unit/bitship.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getShippingRates } from "@/lib/bitship";

describe("getShippingRates", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should return list of rates", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        pricing: [
          {
            courier_code: "jne",
            courier_name: "JNE",
            courier_service_name: "Reguler",
            type: "regular",
            duration: "1-2 days",
            price: 15000,
            company: "jne",
          },
        ],
      }),
    });

    const result = await getShippingRates({
      originLat: -6.2,
      originLng: 106.8,
      destLat: -6.9,
      destLng: 107.6,
      items: [{ name: "Test", value: 100000, weight: 500, quantity: 1 }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].courier_code).toBe("jne");
  });

  it("should throw on API error", async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: "Invalid key" }),
    });

    await expect(
      getShippingRates({
        originLat: 0,
        originLng: 0,
        destLat: 0,
        destLng: 0,
        items: [],
      })
    ).rejects.toThrow("Invalid key");
  });
});
```

---

## 9. Run All Tests

```bash
pnpm test:run
```

Output:
```
✓ tests/unit/utils.test.ts (6)
✓ tests/unit/order-status.test.ts (7)
✓ tests/unit/bitship.test.ts (2)
✓ tests/actions/products.test.ts (3)
✓ tests/api/webhooks-xendit.test.ts (2)

Test Files  5 passed (5)
     Tests  20 passed (20)
```

### Watch Mode (untuk Dev)
```bash
pnpm test
# Auto re-run saat file berubah
```

### Coverage (Optional)
```bash
pnpm add -D @vitest/coverage-v8
pnpm vitest run --coverage
```

---

## 10. Best Practices

### DO
- ✅ Test public API (function signature), bukan internal implementation
- ✅ Test happy path + error cases + edge cases
- ✅ Naming jelas: `it("should return error when not authenticated")`
- ✅ Mock external dependencies (DB, API, auth)
- ✅ Pakai fixtures untuk konsistensi data

### DON'T
- ❌ Test detail implementasi
- ❌ Pakai DB real di unit test
- ❌ Real HTTP call ke Xendit/Bitship
- ❌ Lupa cleanup mock antar test (pakai `beforeEach + vi.clearAllMocks()`)
- ❌ Test yang flaky/random (selalu deterministic)

---

## ✅ Checklist Akhir Sesi 09

- [ ] `vitest.config.ts` siap
- [ ] `tests/setup.ts` set env vars
- [ ] `tests/helpers/fixtures.ts` ada sample data
- [ ] Unit test untuk utils jalan
- [ ] Unit test untuk order status jalan
- [ ] Mock DB pattern dipahami
- [ ] Action test (createProduct) jalan
- [ ] Webhook test jalan
- [ ] `pnpm test:run` semua passed

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `Cannot find module '@/...'` | Path alias di `vitest.config.ts` belum di-set |
| `process.env.X is undefined` | Belum di-set di `tests/setup.ts` |
| Mock tidak ke-reset | Lupa `vi.clearAllMocks()` di `beforeEach` |
| `redirect is not a function` | Mock `next/navigation` belum lengkap |
| Database real ke-hit | Lupa mock `@/lib/db` |

---

## ➡️ Lanjut ke [Sesi 10 — Deploy](./10-deploy.md)
