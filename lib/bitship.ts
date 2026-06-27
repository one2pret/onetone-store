// lib/bitship.ts — Bitship API client (pure fetch wrapper)

export interface BitshipRateRequest {
  origin_latitude: string;
  origin_longitude: string;
  destination_latitude: string;
  destination_longitude: string;
  couriers: string; // "jne,sicepat,jnt"
  items: Array<{ name: string; weight: number; quantity: number; value: number }>;
}

export interface BitshipRate {
  courier_name: string;
  courier_code: string;
  courier_service_name: string;
  courier_service_code: string;
  type: string; // "express" | "regular" | "economy"
  price: number;
  duration: string; // "1-2"
}

export interface BitshipShipmentRequest {
  origin_contact_name: string;
  origin_contact_phone: string;
  origin_address: string;
  origin_coordinate: { latitude: number; longitude: number };
  destination_contact_name: string;
  destination_contact_phone: string;
  destination_address: string;
  destination_coordinate: { latitude: number; longitude: number };
  courier_company: string;
  courier_type: string;
  delivery_type: string;
  items: Array<{ name: string; weight: number; quantity: number; value: number }>;
}

function getConfig() {
  const apiUrl = process.env.BITSHIP_API_URL || 'https://api.biteship.com';
  const apiKey = process.env.BITSHIP_API_KEY;
  if (!apiKey) throw new Error('BITSHIP_API_KEY is not configured');
  return { apiUrl, apiKey };
}

async function bitshipFetch(path: string, options: RequestInit = {}) {
  const { apiUrl, apiKey } = getConfig();
  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Bitship API error (${res.status}): ${body.error || 'Unknown error'}`);
  }

  return res.json();
}

export async function getShippingRates(req: BitshipRateRequest): Promise<BitshipRate[]> {
  const data = await bitshipFetch('/v1/rates/couriers', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return data.pricing ?? [];
}

export async function createShipment(
  req: BitshipShipmentRequest,
): Promise<{ id: string; waybill_id: string }> {
  const data = await bitshipFetch('/v1/orders', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return { id: data.id, waybill_id: data.courier?.waybill_id };
}

export async function getTracking(
  trackingId: string,
): Promise<{ id: string; waybill_id: string; status: string; histories: any[] }> {
  const data = await bitshipFetch(`/v1/orders/${trackingId}`, {
    method: 'GET',
  });
  return {
    id: data.id,
    waybill_id: data.courier?.waybill_id,
    status: data.status,
    histories: data.courier_tracking_history ?? [],
  };
}
