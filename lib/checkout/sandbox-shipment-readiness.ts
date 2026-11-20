/**
 * Read-only readiness checks for an eventual Biteship TEST shipment.
 *
 * No network calls, payload submission, stock adjustment or state changes.
 * A green checklist is NOT permission to create a shipment. Biteship uses
 * the same API URL for live and test: the API key prefix determines mode.
 */
export interface ShipmentReadinessInput {
  orderStatus: string | null | undefined;
  invoiceStatus: string | null | undefined;
  hasSandboxBiteshipKey: boolean;
  hasTracking: boolean;
  origin: {
    contactName?: string | null;
    contactPhone?: string | null;
    address?: string | null;
    latitude?: string | null;
    longitude?: string | null;
  };
  shipping?: {
    recipientName?: string | null;
    phone?: string | null;
    address?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    courierCompany?: string | null;
    courierType?: string | null;
  } | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    weightGrams: number | null | undefined;
  }>;
}

export interface ShipmentReadinessCheck {
  id: string;
  label: string;
  ok: boolean;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validCoordinates(lat: string | null | undefined, lng: string | null | undefined): boolean {
  if (!hasText(lat) || !hasText(lng)) return false;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180 &&
    latitude !== 0 && longitude !== 0;
}

export function isBiteshipSandboxApiKey(key: string | undefined): boolean {
  return typeof key === 'string' && key.startsWith('biteship_test.') && key.length > 'biteship_test.'.length;
}

export function evaluateSandboxShipmentReadiness(input: ShipmentReadinessInput): {
  checks: ShipmentReadinessCheck[];
  dataComplete: boolean;
  estimatedTotalWeightGrams: number | null;
} {
  const itemsValid = input.items.length > 0 && input.items.every(item =>
    hasText(item.name) &&
    Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
    Number.isSafeInteger(item.unitPrice) && item.unitPrice > 0 &&
    Number.isSafeInteger(item.weightGrams) && (item.weightGrams ?? 0) > 0 &&
    Number.isSafeInteger(item.unitPrice * item.quantity) &&
    Number.isSafeInteger(item.weightGrams! * item.quantity),
  );

  const totalsValid = itemsValid &&
    Number.isSafeInteger(input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)) &&
    Number.isSafeInteger(input.items.reduce((sum, item) => sum + item.weightGrams! * item.quantity, 0));

  const checks: ShipmentReadinessCheck[] = [
    { id: 'payment', label: 'Invoice Xendit TEST sudah dibayar', ok: input.invoiceStatus === 'paid' && input.orderStatus === 'packing' },
    { id: 'mode', label: 'Kunci Biteship berjenis TEST (bukan live)', ok: input.hasSandboxBiteshipKey },
    { id: 'origin', label: 'Nama, telepon, alamat, dan koordinat asal valid', ok:
      hasText(input.origin.contactName) &&
      hasText(input.origin.contactPhone) &&
      hasText(input.origin.address) &&
      validCoordinates(input.origin.latitude, input.origin.longitude),
    },
    { id: 'destination', label: 'Data penerima dan koordinat tujuan lengkap', ok:
      !!input.shipping &&
      hasText(input.shipping.recipientName) &&
      hasText(input.shipping.phone) &&
      hasText(input.shipping.address) &&
      validCoordinates(input.shipping.latitude, input.shipping.longitude),
    },
    { id: 'courier', label: 'Kode kurir dan layanan dari pilihan checkout tersedia', ok:
      !!input.shipping &&
      /^[a-z0-9_-]+$/.test(input.shipping.courierCompany ?? '') &&
      /^[a-z0-9_-]+$/.test(input.shipping.courierType ?? ''),
    },
    { id: 'items', label: 'Produk memiliki jumlah, harga satuan dan berat satuan valid', ok: totalsValid },
    { id: 'tracking', label: 'Belum ada resi atau booking pengiriman sebelumnya', ok: !input.hasTracking },
  ];

  const estimatedTotalWeightGrams = totalsValid
    ? input.items.reduce((sum, item) => sum + item.weightGrams! * item.quantity, 0)
    : null;

  return {
    checks,
    dataComplete: checks.every(c => c.ok),
    estimatedTotalWeightGrams,
  };
}
