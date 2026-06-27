// app/(admin)/dashboard/settings/_components/StoreSettingsForm.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upsertStoreSetting } from '@/app/actions/store-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { LocationData } from '@/components/shop/MapPicker';

const MapPicker = dynamic(() => import('@/components/shop/MapPicker').then(m => m.MapPicker), {
  ssr: false,
  loading: () => <div className="w-full h-[300px] bg-slate-100 rounded-lg animate-pulse" />,
});

interface Props {
  settings: Record<string, string>;
}

export function StoreSettingsForm({ settings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [storeName, setStoreName] = useState(settings.store_name || '');
  const [storePhone, setStorePhone] = useState(settings.store_phone || '');
  const [storeAddress, setStoreAddress] = useState(settings.store_address || '');
  const [lat, setLat] = useState(settings.store_latitude || '');
  const [lng, setLng] = useState(settings.store_longitude || '');
  const [expiryHours, setExpiryHours] = useState(settings.payment_expiry_hours || '24');

  function handleLocationSelect(location: LocationData) {
    setLat(String(location.lat));
    setLng(String(location.lng));
    if (location.address) {
      setStoreAddress(location.address);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const pairs = [
        ['store_name', storeName],
        ['store_phone', storePhone],
        ['store_address', storeAddress],
        ['store_latitude', lat],
        ['store_longitude', lng],
        ['payment_expiry_hours', expiryHours],
      ];

      for (const [key, value] of pairs) {
        const result = await upsertStoreSetting(key, value);
        if (!result.success) {
          toast.error(`Gagal menyimpan ${key}: ${result.error}`);
          return;
        }
      }

      toast.success('Pengaturan toko berhasil disimpan');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Info Toko */}
      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Informasi Toko</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="storeName">Nama Toko</Label>
            <Input
              id="storeName"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="Nama toko"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storePhone">No. Telepon</Label>
            <Input
              id="storePhone"
              value={storePhone}
              onChange={e => setStorePhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
            />
          </div>
        </div>
      </div>

      {/* Lokasi Toko */}
      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Lokasi Toko (Origin Pengiriman)</h2>
        <p className="text-sm text-slate-500 mb-4">Lokasi ini digunakan sebagai titik asal untuk menghitung ongkos kirim.</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storeAddress">Alamat Lengkap</Label>
            <Input
              id="storeAddress"
              value={storeAddress}
              onChange={e => setStoreAddress(e.target.value)}
              placeholder="Jl. Contoh No. 1, Kecamatan, Kota"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="-6.xxxx"
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng">Longitude</Label>
              <Input
                id="lng"
                value={lng}
                onChange={e => setLng(e.target.value)}
                placeholder="106.xxxx"
                readOnly
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Pilih Lokasi di Peta</Label>
            <MapPicker
              onLocationSelect={handleLocationSelect}
              defaultLat={lat ? parseFloat(lat) : -6.1380}
              defaultLng={lng ? parseFloat(lng) : 106.8294}
            />
          </div>
        </div>
      </div>

      {/* Pembayaran */}
      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Pengaturan Pembayaran</h2>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="expiryHours">Batas Waktu Pembayaran (jam)</Label>
          <Input
            id="expiryHours"
            type="number"
            min="1"
            max="72"
            value={expiryHours}
            onChange={e => setExpiryHours(e.target.value)}
          />
          <p className="text-xs text-slate-400">Pesanan akan otomatis expired jika belum dibayar dalam waktu ini.</p>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Simpan Pengaturan
        </Button>
      </div>
    </form>
  );
}
