// components/shop/ShippingOptions.tsx
'use client';

import Image from 'next/image';
import { formatRupiah } from '@/lib/utils';
import { Truck, Check, Loader2, Zap, Package, Wallet, Clock } from 'lucide-react';
import type { BitshipRate } from '@/lib/bitship';

interface GroupedRates {
  express: BitshipRate[];
  regular: BitshipRate[];
  economy: BitshipRate[];
}

interface Props {
  rates: GroupedRates | null;
  loading: boolean;
  selectedRate: BitshipRate | null;
  onSelect: (rate: BitshipRate) => void;
}

const TYPE_BADGE: Record<string, { label: string; icon: typeof Zap; badgeColor: string }> = {
  express: { label: 'Express', icon: Zap, badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  regular: { label: 'Regular', icon: Package, badgeColor: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  economy: { label: 'Ekonomi', icon: Wallet, badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

function formatDuration(d: string): string {
  // "1 - 2 days" → "1 - 2 hari", "3 days" → "3 hari", "1-2" → "1-2 hari"
  const cleaned = d.replace(/\s*days?\s*/gi, '').trim();
  return `${cleaned} hari`;
}

// Map known courier codes to display names for cleaner UI
function getCourierLogo(code: string) {
  const logos: Record<string, string> = {
    jne: 'JNE',
    jnt: 'J&T',
    sicepat: 'SiCepat',
    tiki: 'TIKI',
    anteraja: 'AnterAja',
    ninja: 'Ninja',
    lion: 'Lion',
    pos: 'POS',
    rpx: 'RPX',
  };
  return logos[code] || code.toUpperCase();
}

function parseDurationMin(d: string): number {
  const nums = d.replace(/[^0-9.-]/g, ' ').trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
  return nums.length > 0 ? nums[0] : 999;
}

interface CourierGroup {
  code: string;
  name: string;
  rates: BitshipRate[];
  fastestDuration: number;
}

function groupByCourier(rates: GroupedRates): CourierGroup[] {
  const allRates = [...rates.express, ...rates.regular, ...rates.economy];
  const map = new Map<string, CourierGroup>();

  for (const rate of allRates) {
    const dur = parseDurationMin(rate.duration);
    const existing = map.get(rate.courier_code);
    if (existing) {
      existing.rates.push(rate);
      if (dur < existing.fastestDuration) existing.fastestDuration = dur;
    } else {
      map.set(rate.courier_code, {
        code: rate.courier_code,
        name: rate.courier_name,
        rates: [rate],
        fastestDuration: dur,
      });
    }
  }

  const groups = Array.from(map.values());
  groups.sort((a, b) => a.fastestDuration - b.fastestDuration);
  for (const g of groups) {
    g.rates.sort((a, b) => parseDurationMin(a.duration) - parseDurationMin(b.duration));
  }
  return groups;
}

function RateCard({
  rate,
  selected,
  onSelect,
}: {
  rate: BitshipRate;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = TYPE_BADGE[rate.type];
  const BadgeIcon = badge?.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary bg-accent shadow-sm'
          : 'border-border hover:border-primary/40 bg-card'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {rate.courier_service_name}
            </p>
            {badge && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badge.badgeColor}`}>
                {BadgeIcon && <BadgeIcon className="w-2.5 h-2.5" />}
                {badge.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {formatDuration(rate.duration)}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right flex items-center gap-2">
          <span className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-foreground'}`}>
            {formatRupiah(rate.price)}
          </span>
          {selected && (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-primary-foreground" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function ShippingOptions({ rates, loading, selectedRate, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mb-3 text-primary" />
        <p className="text-sm font-medium text-foreground">Menghitung ongkos kirim...</p>
        <p className="text-xs text-muted-foreground mt-1">Sedang mengecek tarif dari beberapa kurir</p>
      </div>
    );
  }

  if (!rates) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Truck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
        <p className="font-medium text-foreground">Pilih alamat terlebih dahulu</p>
        <p className="text-sm text-muted-foreground mt-1">Opsi pengiriman akan muncul setelah alamat dipilih</p>
      </div>
    );
  }

  const hasRates =
    rates.express.length > 0 || rates.regular.length > 0 || rates.economy.length > 0;

  if (!hasRates) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Truck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
        <p className="font-medium text-foreground">Tidak ada opsi pengiriman</p>
        <p className="text-sm text-muted-foreground mt-1">Coba gunakan alamat lain</p>
      </div>
    );
  }

  const totalOptions = rates.express.length + rates.regular.length + rates.economy.length;
  const courierGroups = groupByCourier(rates);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-3 bg-muted border border-border rounded-xl">
        <Image src="/images/bitship-logo.png" alt="Bitship" width={100} height={28} className="h-6 w-auto shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Data pengiriman realtime dari <span className="font-semibold text-primary">Bitship</span></p>
          <p className="text-[11px] text-muted-foreground">{totalOptions} opsi pengiriman tersedia</p>
        </div>
        <a
          href="https://explore.bitship.com/id/ads/api"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[11px] font-medium text-primary hover:text-primary-hover hover:underline transition"
        >
          Pelajari Bitship &rarr;
        </a>
      </div>

      {courierGroups.map((group) => {
        const courierLabel = getCourierLogo(group.code);

        return (
          <div key={group.code}>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-14 h-8 rounded-lg bg-muted border border-border text-xs font-bold text-foreground">
                {courierLabel}
              </span>
              <span className="text-xs text-muted-foreground">{group.rates.length} layanan</span>
            </div>
            <div className="space-y-2">
              {group.rates.map((rate, i) => (
                <RateCard
                  key={`${rate.courier_code}-${rate.courier_service_code}-${i}`}
                  rate={rate}
                  selected={
                    selectedRate?.courier_code === rate.courier_code &&
                    selectedRate?.courier_service_code === rate.courier_service_code
                  }
                  onSelect={() => onSelect(rate)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
