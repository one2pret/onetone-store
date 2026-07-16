// app/(shop)/checkout/CheckoutForm.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOrder } from '@/app/actions/orders';
import { validateVoucher, getAvailableVouchers, type VoucherValidationResult, type AvailableVoucher } from '@/app/actions/voucher';
import { calculateShippingRates, type ShippingRouteInfo } from '@/app/actions/shipping';
import { POINTS_REDEEM_VALUE, calculateRedeemAmount } from '@/lib/membership-utils';
import { getUserAddresses } from '@/app/actions/addresses';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AddressSelector } from '@/components/shop/AddressSelector';
import { ShippingOptions } from '@/components/shop/ShippingOptions';
import { formatRupiah } from '@/lib/utils';
import type { Address, CartItemWithProduct } from '@/lib/db/schema';
import type { BitshipRate } from '@/lib/bitship';
import { MapPin, Truck, CreditCard, ChevronRight, ChevronLeft, Loader2, Store, ArrowRight, Tag, X, Check } from 'lucide-react';

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
  tierFreeShipping: boolean;
  pointsBalance: number;
}

const STEPS = [
  { id: 1, label: 'Alamat', icon: MapPin },
  { id: 2, label: 'Kurir', icon: Truck },
  { id: 3, label: 'Bayar', icon: CreditCard },
];

export function CheckoutForm({ addresses: initialAddresses, cart, subtotal, tierFreeShipping, pointsBalance }: Props) {
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

  // Voucher state
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherResult, setVoucherResult] = useState<VoucherValidationResult | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [availableVouchers, setAvailableVouchers] = useState<AvailableVoucher[] | null>(null);
  const [showVoucherList, setShowVoucherList] = useState(false);
  const [loadingVouchers, setLoadingVouchers] = useState(false);

  // Points state
  const [usePoints, setUsePoints] = useState(false);

  const rawShippingCost = selectedRate?.price ?? 0;
  const freeShipping = tierFreeShipping || (voucherResult?.valid && voucherResult.freeShipping);
  const shippingCost = freeShipping ? 0 : rawShippingCost;
  const discountAmount = voucherResult?.valid ? voucherResult.discountAmount : 0;
  const afterVoucher = subtotal - discountAmount + shippingCost;
  const redeemAmount = usePoints && pointsBalance > 0
    ? calculateRedeemAmount(pointsBalance, afterVoucher)
    : 0;
  const pointsToRedeem = redeemAmount > 0 ? Math.ceil(redeemAmount / POINTS_REDEEM_VALUE) : 0;
  const total = afterVoucher - redeemAmount;

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

  async function handleApplyVoucher() {
    if (!voucherInput.trim()) return;
    setVoucherLoading(true);
    const result = await validateVoucher(voucherInput.trim(), subtotal);
    setVoucherResult(result);
    setVoucherLoading(false);
  }

  function handleRemoveVoucher() {
    setVoucherResult(null);
    setVoucherInput('');
    setShowVoucherList(false);
  }

  async function handleToggleVoucherList() {
    if (showVoucherList) { setShowVoucherList(false); return; }
    setShowVoucherList(true);
    if (availableVouchers !== null) return;
    setLoadingVouchers(true);
    const list = await getAvailableVouchers(subtotal);
    setAvailableVouchers(list);
    setLoadingVouchers(false);
  }

  async function handleSelectVoucher(code: string) {
    setVoucherInput(code);
    setShowVoucherList(false);
    setVoucherLoading(true);
    const result = await validateVoucher(code, subtotal);
    setVoucherResult(result);
    setVoucherLoading(false);
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
      if (voucherResult?.valid) formData.set('voucherCode', voucherResult.code);
      if (pointsToRedeem > 0) formData.set('pointsToRedeem', String(pointsToRedeem));

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
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : step > s.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Address */}
      {step === 1 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
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
          <div className="flex items-center gap-3 p-4 bg-accent border border-border rounded-xl mb-4">
            <Store className="w-5 h-5 text-primary shrink-0" />
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="text-muted-foreground truncate">{routeInfo.originCity}</span>
              <ArrowRight className="w-4 h-4 text-primary shrink-0" />
              <span className="text-foreground font-semibold truncate">{routeInfo.destinationCity}</span>
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Pilih Kurir Pengiriman
          </h2>

          {/* Selected address summary */}
          {(() => {
            const addr = addressList.find(a => a.id === selectedAddressId);
            if (!addr) return null;
            return (
              <div className="mb-5 p-3 bg-muted rounded-lg flex items-start gap-3">
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{addr.recipientName} <span className="text-muted-foreground font-normal">{addr.phone}</span></p>
                  <p className="text-sm text-muted-foreground mt-0.5">{addr.address}, {addr.district}, {addr.city}, {addr.province}</p>
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
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Review Pesanan
            </h2>

            {/* Selected Address */}
            {selectedAddressId && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Alamat Pengiriman</p>
                {(() => {
                  const addr = addressList.find(a => a.id === selectedAddressId);
                  if (!addr) return null;
                  return (
                    <>
                      <p className="text-sm font-medium text-foreground">{addr.recipientName}</p>
                      <p className="text-sm text-muted-foreground">{addr.phone}</p>
                      <p className="text-sm text-muted-foreground">{addr.address}</p>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Selected Courier */}
            {selectedRate && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Kurir</p>
                <p className="text-sm font-medium text-foreground">
                  {selectedRate.courier_name} {selectedRate.courier_service_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Estimasi {formatDuration(selectedRate.duration)} — {formatRupiah(selectedRate.price)}
                </p>
              </div>
            )}

            {/* Voucher Input */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Tag className="w-4 h-4" /> Kode Voucher
                </p>
                <button
                  type="button"
                  onClick={handleToggleVoucherList}
                  className="text-xs text-primary hover:text-primary-hover transition font-medium"
                >
                  {showVoucherList ? 'Tutup' : 'Pilih Voucher'}
                </button>
              </div>

              {/* Voucher list picker */}
              {showVoucherList && (
                <div className="mb-3 border border-border rounded-xl overflow-hidden">
                  {loadingVouchers ? (
                    <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Memuat voucher...
                    </div>
                  ) : availableVouchers?.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-5">
                      Tidak ada voucher yang tersedia untuk pesanan ini.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {availableVouchers?.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectVoucher(v.code)}
                          className="w-full text-left px-4 py-3 hover:bg-surface transition flex items-start gap-3 group"
                        >
                          <div className="mt-0.5 shrink-0 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold tracking-wide">
                            {v.code}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {v.freeShipping
                                ? 'Gratis Ongkos Kirim'
                                : v.type === 'percent'
                                  ? `Diskon ${v.value}%`
                                  : `Diskon Rp ${v.value.toLocaleString('id-ID')}`}
                            </p>
                            <p className="text-xs text-success mt-0.5">
                              Hemat {v.freeShipping ? 'ongkir' : `Rp ${v.discountAmount.toLocaleString('id-ID')}`}
                            </p>
                            {v.minSpend > 0 && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Min. belanja Rp {v.minSpend.toLocaleString('id-ID')}
                              </p>
                            )}
                            {v.endsAt && (
                              <p className="text-[11px] text-muted-foreground">
                                Berlaku s/d {new Date(v.endsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-foreground transition" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {voucherResult?.valid ? (
                <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg text-sm">
                  <Check className="w-4 h-4 text-success shrink-0" />
                  <span className="text-success flex-1">{voucherResult.message}</span>
                  <button onClick={handleRemoveVoucher} className="text-muted-foreground hover:text-foreground transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()}
                    placeholder="Masukkan kode voucher"
                    className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyVoucher}
                    disabled={voucherLoading || !voucherInput.trim()}
                    className="shrink-0"
                  >
                    {voucherLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Pakai'}
                  </Button>
                </div>
              )}
              {voucherResult && !voucherResult.valid && (
                <p className="text-xs text-destructive mt-1.5">{voucherResult.error}</p>
              )}
            </div>

            {/* Points */}
            {pointsBalance > 0 && (
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Gunakan Poin</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pointsBalance} poin tersedia (senilai {formatRupiah(pointsBalance * POINTS_REDEEM_VALUE)})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUsePoints(!usePoints)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      usePoints ? 'bg-primary' : 'bg-muted'
                    }`}
                    aria-pressed={usePoints}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${
                      usePoints ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                {usePoints && redeemAmount > 0 && (
                  <p className="text-xs text-success mt-2">
                    ✓ {pointsToRedeem} poin digunakan, hemat {formatRupiah(redeemAmount)}
                  </p>
                )}
              </div>
            )}

            {/* Price Summary */}
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal ({cart.length} item)</span>
                <span className="text-foreground">{formatRupiah(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-success">Diskon Voucher</span>
                  <span className="text-success">-{formatRupiah(discountAmount)}</span>
                </div>
              )}
              {redeemAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-success">Redeem Poin ({pointsToRedeem} poin)</span>
                  <span className="text-success">-{formatRupiah(redeemAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Ongkos Kirim</span>
                {freeShipping ? (
                  <span className="text-success font-medium">GRATIS</span>
                ) : (
                  <span className="text-foreground">{formatRupiah(rawShippingCost)}</span>
                )}
              </div>
              {tierFreeShipping && (
                <p className="text-xs text-success">✓ Gratis ongkir dari benefit membership</p>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-semibold text-lg">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{formatRupiah(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-card rounded-xl border border-border p-6">
            <Label htmlFor="notes" className="text-sm font-medium text-foreground">
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
