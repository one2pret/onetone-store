// app/(shop)/checkout/CheckoutForm.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOrder } from '@/app/actions/orders';
import { calculateShippingRates, type ShippingRouteInfo } from '@/app/actions/shipping';
import { getUserAddresses } from '@/app/actions/addresses';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AddressSelector } from '@/components/shop/AddressSelector';
import { ShippingOptions } from '@/components/shop/ShippingOptions';
import { formatRupiah } from '@/lib/utils';
import type { Address, CartItemWithProduct } from '@/lib/db/schema';
import type { BitshipRate } from '@/lib/bitship';
import { MapPin, Truck, CreditCard, ChevronRight, ChevronLeft, Loader2, Store, ArrowRight } from 'lucide-react';

function formatDuration(d: string): string {
  const cleaned = d.replace(/\s*days?\s*/gi, '').trim();
  return `${cleaned} hari`;
}

interface GroupedRates {
  express: BitshipRate[];
  regular: BitshipRate[];
  economy: BitshipRate[];
}

interface Props {
  addresses: Address[];
  cart: CartItemWithProduct[];
  subtotal: number;
}

const STEPS = [
  { id: 1, label: 'Alamat', icon: MapPin },
  { id: 2, label: 'Kurir', icon: Truck },
  { id: 3, label: 'Bayar', icon: CreditCard },
];

export function CheckoutForm({ addresses: initialAddresses, cart, subtotal }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [addressList, setAddressList] = useState<Address[]>(initialAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    initialAddresses.find(a => a.isDefault)?.id ?? initialAddresses[0]?.id ?? null
  );
  const [rates, setRates] = useState<GroupedRates | null>(null);
  const [routeInfo, setRouteInfo] = useState<ShippingRouteInfo | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [selectedRate, setSelectedRate] = useState<BitshipRate | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const shippingCost = selectedRate?.price ?? 0;
  const total = subtotal + shippingCost;

  async function handleAddressCreated() {
    const fresh = await getUserAddresses();
    setAddressList(fresh);
    // Auto-select the newest address (last created)
    if (fresh.length > 0) {
      const newest = fresh[fresh.length - 1];
      // If there's a default, prefer it; otherwise pick newest
      const defaultAddr = fresh.find(a => a.isDefault);
      setSelectedAddressId(defaultAddr?.id ?? newest.id);
    }
  }

  async function handleAddressNext() {
    if (!selectedAddressId) {
      setError('Pilih alamat pengiriman');
      return;
    }
    setError('');
    setLoadingRates(true);
    setStep(2);

    const result = await calculateShippingRates(selectedAddressId);
    setLoadingRates(false);

    if (!result.success) {
      setError(result.error || 'Gagal menghitung ongkir');
      return;
    }

    setRates(result.data ?? null);
    setRouteInfo(result.route ?? null);
  }

  function handleCourierNext() {
    if (!selectedRate) {
      setError('Pilih kurir pengiriman');
      return;
    }
    setError('');
    setStep(3);
  }

  function handleSubmit() {
    if (!selectedAddressId || !selectedRate) return;

    setError('');
    startTransition(async () => {
      const formData = new FormData();
      formData.set('addressId', String(selectedAddressId));
      formData.set('courierName', `${selectedRate.courier_name} ${selectedRate.courier_service_name}`);
      formData.set('courierCompany', selectedRate.courier_code);
      formData.set('courierType', selectedRate.courier_service_code);
      formData.set('courierPrice', String(selectedRate.price));
      formData.set('notes', notes);

      const result = await createOrder(null, formData);

      if (!result.success) {
        setError(result.error || 'Gagal membuat pesanan');
        return;
      }

      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        router.push(`/orders/${result.orderId}`);
      }
    });
  }

  return (
    <div>
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                step === s.id
                  ? 'bg-primary text-white'
                  : step > s.id
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300" />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Step 1: Address */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Pilih Alamat Pengiriman
          </h2>
          <AddressSelector
            addresses={addressList}
            selectedId={selectedAddressId}
            onSelect={setSelectedAddressId}
            onAddressCreated={handleAddressCreated}
          />
          <div className="mt-6 flex justify-end">
            <Button onClick={handleAddressNext} disabled={!selectedAddressId}>
              Pilih Kurir
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Courier */}
      {step === 2 && (
        <>
        {routeInfo && (
          <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl mb-4">
            <Store className="w-5 h-5 text-primary shrink-0" />
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="text-slate-700 truncate">{routeInfo.originCity}</span>
              <ArrowRight className="w-4 h-4 text-primary shrink-0" />
              <span className="text-slate-900 font-semibold truncate">{routeInfo.destinationCity}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Pilih Kurir Pengiriman
          </h2>

          {/* Selected address summary */}
          {(() => {
            const addr = addressList.find(a => a.id === selectedAddressId);
            if (!addr) return null;
            return (
              <div className="mb-5 p-3 bg-slate-50 rounded-lg flex items-start gap-3">
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{addr.recipientName} <span className="text-slate-400 font-normal">{addr.phone}</span></p>
                  <p className="text-sm text-slate-500 mt-0.5">{addr.address}, {addr.district}, {addr.city}, {addr.province}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="text-xs text-primary hover:text-primary-hover font-medium shrink-0"
                >
                  Ubah
                </button>
              </div>
            );
          })()}

          <ShippingOptions
            rates={rates}
            loading={loadingRates}
            selectedRate={selectedRate}
            onSelect={setSelectedRate}
          />
          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={() => { setStep(1); setError(''); }}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Ubah Alamat
            </Button>
            <Button onClick={handleCourierNext} disabled={!selectedRate || loadingRates}>
              Review Pesanan
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
        </>
      )}

      {/* Step 3: Review & Pay */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Review Pesanan
            </h2>

            {/* Selected Address */}
            {selectedAddressId && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Alamat Pengiriman</p>
                {(() => {
                  const addr = addressList.find(a => a.id === selectedAddressId);
                  if (!addr) return null;
                  return (
                    <>
                      <p className="text-sm font-medium">{addr.recipientName}</p>
                      <p className="text-sm text-slate-600">{addr.phone}</p>
                      <p className="text-sm text-slate-500">{addr.address}</p>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Selected Courier */}
            {selectedRate && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Kurir</p>
                <p className="text-sm font-medium">
                  {selectedRate.courier_name} {selectedRate.courier_service_name}
                </p>
                <p className="text-sm text-slate-500">
                  Estimasi {formatDuration(selectedRate.duration)} — {formatRupiah(selectedRate.price)}
                </p>
              </div>
            )}

            {/* Price Summary */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal ({cart.length} item)</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Ongkos Kirim</span>
                <span>{formatRupiah(shippingCost)}</span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span className="text-primary">{formatRupiah(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <Label htmlFor="notes" className="text-sm font-medium text-slate-700">
              Catatan (Opsional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Catatan untuk penjual..."
              className="mt-2"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setStep(2); setError(''); }}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Ubah Kurir
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="py-6 px-8 text-base font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                `Bayar ${formatRupiah(total)}`
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
