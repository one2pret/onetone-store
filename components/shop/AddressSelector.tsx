// components/shop/AddressSelector.tsx
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Address } from '@/lib/db/schema';
import { createAddress } from '@/app/actions/addresses';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Check, Plus, X, Loader2, ChevronDown } from 'lucide-react';
import type { LocationData } from '@/components/shop/MapPicker';

const MapPicker = dynamic(() => import('@/components/shop/MapPicker').then(m => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Memuat peta...
    </div>
  ),
});

const REGION_API = 'https://www.emsifa.com/api-wilayah-indonesia/api';

interface Region {
  id: string;
  name: string;
}

function toTitleCase(str: string) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function useRegions(url: string | null) {
  const [data, setData] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setData([]);
      return;
    }
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d: Region[]) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading };
}

interface Props {
  addresses: Address[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAddressCreated?: () => void;
}

function RegionSelect({
  label,
  name,
  options,
  loading,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  name: string;
  options: Region[];
  loading: boolean;
  value: string;
  onChange: (id: string, name: string) => void;
  disabled?: boolean;
  error?: string[];
}) {
  return (
    <div>
      <Label htmlFor={name} className="text-sm text-slate-600">{label} *</Label>
      <div className="relative mt-1">
        <select
          id={name}
          required
          disabled={disabled || loading}
          value={value}
          onChange={(e) => {
            const opt = options.find((o) => o.id === e.target.value);
            onChange(e.target.value, opt ? toTitleCase(opt.name) : '');
          }}
          className="w-full h-10 pl-3 pr-9 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {loading ? 'Memuat...' : `Pilih ${label}`}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {toTitleCase(o.name)}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>
      {/* Hidden inputs: name (display) + ID (for re-select on edit) */}
      <input type="hidden" name={name} value={value ? (options.find(o => o.id === value) ? toTitleCase(options.find(o => o.id === value)!.name) : '') : ''} />
      <input type="hidden" name={`${name}Id`} value={value} />
      {error && <p className="text-red-500 text-xs mt-1">{error[0]}</p>}
    </div>
  );
}

function AddAddressForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Region state
  const [provinceId, setProvinceId] = useState('');
  const [cityId, setCityId] = useState('');
  const [districtId, setDistrictId] = useState('');

  // Map / coordinates
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const provinces = useRegions(`${REGION_API}/provinces.json`);
  const cities = useRegions(provinceId ? `${REGION_API}/regencies/${provinceId}.json` : null);
  const districts = useRegions(cityId ? `${REGION_API}/districts/${cityId}.json` : null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const form = e.currentTarget;
    const formData = new FormData(form);

    const result = await createAddress(formData);

    if (result.success) {
      onSuccess();
    } else if (result.errors) {
      setErrors(result.errors as Record<string, string[]>);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-800">Tambah Alamat Baru</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {errors._form && (
        <p className="text-red-500 text-sm">{errors._form[0]}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="recipientName" className="text-sm text-slate-600">Nama Penerima *</Label>
          <Input id="recipientName" name="recipientName" required placeholder="Nama lengkap" className="mt-1" />
          {errors.recipientName && <p className="text-red-500 text-xs mt-1">{errors.recipientName[0]}</p>}
        </div>
        <div>
          <Label htmlFor="phone" className="text-sm text-slate-600">No. HP *</Label>
          <Input id="phone" name="phone" required placeholder="08xxxxxxxxxx" className="mt-1" />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone[0]}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="address" className="text-sm text-slate-600">Alamat Lengkap *</Label>
        <Textarea id="address" name="address" required rows={2} placeholder="Jalan, RT/RW, No. Rumah..." className="mt-1" />
        {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address[0]}</p>}
      </div>

      <div>
        <Label htmlFor="detail" className="text-sm text-slate-600">Detail Tambahan</Label>
        <Input id="detail" name="detail" placeholder="Patokan, warna rumah, dll." className="mt-1" />
      </div>

      {/* Map Picker */}
      <div>
        <Label className="text-sm text-slate-600">Pin Lokasi di Peta</Label>
        <div className="mt-1">
          <MapPicker
            onLocationSelect={(loc: LocationData) => {
              setLatitude(String(loc.lat));
              setLongitude(String(loc.lng));
            }}
          />
        </div>
        <input type="hidden" name="latitude" value={latitude} />
        <input type="hidden" name="longitude" value={longitude} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RegionSelect
          label="Provinsi"
          name="province"
          options={provinces.data}
          loading={provinces.loading}
          value={provinceId}
          onChange={(id) => {
            setProvinceId(id);
            setCityId('');
            setDistrictId('');
          }}
          error={errors.province}
        />
        <RegionSelect
          label="Kota/Kabupaten"
          name="city"
          options={cities.data}
          loading={cities.loading}
          value={cityId}
          disabled={!provinceId}
          onChange={(id) => {
            setCityId(id);
            setDistrictId('');
          }}
          error={errors.city}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RegionSelect
          label="Kecamatan"
          name="district"
          options={districts.data}
          loading={districts.loading}
          value={districtId}
          disabled={!cityId}
          onChange={(id) => {
            setDistrictId(id);
          }}
          error={errors.district}
        />
        <div>
          <Label htmlFor="postalCode" className="text-sm text-slate-600">Kode Pos *</Label>
          <Input id="postalCode" name="postalCode" required placeholder="12160" className="mt-1" />
          {errors.postalCode && <p className="text-red-500 text-xs mt-1">{errors.postalCode[0]}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="label" className="text-sm text-slate-600">Label</Label>
        <Input id="label" name="label" placeholder="Rumah, Kantor, dll." className="mt-1" />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="isDefault" name="isDefault" className="rounded border-slate-300" />
        <Label htmlFor="isDefault" className="text-sm text-slate-600 cursor-pointer">Jadikan alamat utama</Label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              Menyimpan...
            </>
          ) : (
            'Simpan Alamat'
          )}
        </Button>
      </div>
    </form>
  );
}

export function AddressSelector({ addresses, selectedId, onSelect, onAddressCreated }: Props) {
  const [showForm, setShowForm] = useState(false);

  function handleAddressCreated() {
    setShowForm(false);
    onAddressCreated?.();
  }

  if (showForm) {
    return (
      <div className="border border-slate-200 rounded-xl p-5">
        <AddAddressForm onSuccess={handleAddressCreated} onCancel={() => setShowForm(false)} />
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <div className="text-center py-8">
        <MapPin className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-600 font-medium">Belum ada alamat tersimpan</p>
        <p className="text-sm text-slate-400 mt-1 mb-5">Tambahkan alamat pengiriman untuk melanjutkan</p>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Tambah Alamat
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.map((addr) => (
        <button
          key={addr.id}
          type="button"
          onClick={() => onSelect(addr.id)}
          className={`w-full text-left p-4 rounded-lg border-2 transition ${
            selectedId === addr.id
              ? 'border-primary bg-primary/5'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-800">{addr.recipientName}</span>
                {addr.isDefault && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Default
                  </span>
                )}
                {addr.label && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {addr.label}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600">{addr.phone}</p>
              <p className="text-sm text-slate-500 mt-1">{addr.address}</p>
              {addr.detail && (
                <p className="text-sm text-slate-400">{addr.detail}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {addr.district}, {addr.city}, {addr.province} {addr.postalCode}
              </p>
            </div>
            {selectedId === addr.id && (
              <Check className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
            )}
          </div>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="w-full p-4 rounded-lg border-2 border-dashed border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-primary"
      >
        <Plus className="w-4 h-4" />
        Tambah Alamat Baru
      </button>
    </div>
  );
}
