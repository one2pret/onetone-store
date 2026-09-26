import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  selectRows: [] as unknown[],
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(async () => undefined),
  upload: vi.fn(async (key: string) => ({
    objectKey: key,
    url: `https://cdn.example.com/${key}`,
    filesize: 100,
    checksum: "checksum",
  })),
  processImage: vi.fn(async (buffer: Buffer) => ({
    original: { buffer, width: 400, height: 200, format: "png", filesize: buffer.length },
    main: { buffer, width: 400, height: 200, filesize: buffer.length },
    thumb: { buffer, width: 200, height: 100, filesize: buffer.length },
  })),
}));

function queryChain(getValue: () => unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "limit", "set", "values"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: (value: unknown) => unknown) => resolve(getValue());
  return chain;
}

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => queryChain(() => mocks.selectRows)),
    insert: vi.fn(() => {
      mocks.insert();
      return queryChain(() => undefined);
    }),
    update: vi.fn(() => {
      mocks.update();
      return queryChain(() => undefined);
    }),
    delete: vi.fn(() => queryChain(() => undefined)),
  },
}));
vi.mock("@/lib/storage", () => ({
  generateObjectKey: vi.fn((folder: string, extension: string) => `${folder}/generated.${extension}`),
  storage: {
    getUrl: (key: string) => `https://cdn.example.com/${key}`,
    upload: mocks.upload,
    delete: mocks.remove,
  },
}));
vi.mock("@/lib/image-processor", () => ({
  detectMimeFromBuffer: vi.fn(() => "image/png"),
  validateImageBuffer: vi.fn(),
  processProductImage: mocks.processImage,
}));

import {
  getPosSettings,
  updateReceiptSettings,
  uploadReceiptLogo,
} from "@/app/actions/pos-settings";

describe("POS receipt settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectRows = [];
    mocks.auth.mockResolvedValue({ user: { id: "1", role: "admin" } });
  });

  it("uses receipt overrides and falls back to general store information", async () => {
    mocks.selectRows = [
      { key: "store_name", value: "Nama Umum" },
      { key: "store_phone", value: "0812000000" },
      { key: "store_address", value: "Alamat Umum" },
      { key: "pos_receipt_store_name", value: "Nama Struk" },
      { key: "pos_receipt_store_address", value: "Alamat Kasir" },
      { key: "pos_receipt_logo_object_key", value: "pos/receipt-logo/logo.webp" },
    ];

    const settings = await getPosSettings();

    expect(settings).toMatchObject({
      storeName: "Nama Struk",
      storePhone: "0812000000",
      storeAddress: "Alamat Kasir",
      receiptLogoUrl: "https://cdn.example.com/pos/receipt-logo/logo.webp",
    });
  });

  it("validates receipt identity before writing settings", async () => {
    const result = await updateReceiptSettings({
      storeName: "",
      storePhone: "",
      storeAddress: "",
      receiptFooter: "",
    });

    expect(result).toEqual({ success: false, error: "Nama toko pada struk wajib diisi" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("stores all receipt identity fields", async () => {
    const result = await updateReceiptSettings({
      storeName: "Onetone Cimahi",
      storePhone: "081234567890",
      storeAddress: "Jl. Contoh No. 10",
      receiptFooter: "Terima kasih",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.insert).toHaveBeenCalledTimes(4);
  });

  it("replaces the old receipt logo only after the new upload succeeds", async () => {
    mocks.selectRows = [{ value: "pos/receipt-logo/old.webp" }];
    const formData = new FormData();
    formData.set("image", new File([new Uint8Array([1, 2, 3])], "logo.png", { type: "image/png" }));

    const result = await uploadReceiptLogo(formData);

    expect(result).toMatchObject({ success: true });
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith("pos/receipt-logo/old.webp");
  });

  it("blocks non-admin receipt changes", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "2", role: "cashier" } });

    const result = await updateReceiptSettings({
      storeName: "Kasir",
      storePhone: "",
      storeAddress: "",
      receiptFooter: "",
    });

    expect(result).toEqual({ success: false, error: "Hanya admin yang dapat mengubah pengaturan" });
  });
});
