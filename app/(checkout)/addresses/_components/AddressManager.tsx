// app/(shop)/addresses/_components/AddressManager.tsx
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Address } from '@/lib/db/schema';
import type { LocationData } from '@/components/shop/MapPicker';
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '@/app/actions/addresses';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  MapPin, Plus, X, Loader2, ChevronDown,
  Pencil, Trash2, Star, MoreVertical,
} from 'lucide-react';

const REGION_API = 'https://www.emsifa.com/api-wilayah-indonesia/api';

const MapPicker = dynamic(
  () => import('@/components/shop/MapPicker').then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[250px] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-400">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Memuat peta...
      </div>
    ),
  }
);

interface Region {
  id: string;
  name: string;
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function useRegions(url: string | null) {
  const [data, setData] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) { setData([]); return; }
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d: Region[]) => setData(d))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading };
}

function RegionSelect({
  label, name, options, loading, value, onChange, disabled, error,
}: {
  label: string; name: string; options: Region[]; loading: boolean;
  value: string; onChange: (id: string) => void; disabled?: boolean; error?: string[];
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
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 pl-3 pr-9 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">{loading ? 'Memuat...' : `Pilih ${label}`}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{toTitleCase(o.name)}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      <input type="hidden" name={name} value={value ? (options.find(o => o.id === value) ? toTitleCase(options.find(o => o.id === value)!.name) : '') : ''} />
      <input type="hidden" name={`${name}Id`} value={value} />
      {error && <p className="text-red-500 text-xs mt-1">{error[0]}</p>}
    </div>
  );
}

// ─── Address Form (Create / Edit) ─────────────────────────
function AddressForm({
  address,
  onSuccess,
  onCancel,
}: {
  address?: Address;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!address;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [provinceId, setProvinceId] = useState(address?.provinceId || '');
  const [cityId, setCityId] = useState(address?.cityId || '');
  const [districtId, setDistrictId] = useState(address?.districtId || '');
  const [latitude, setLatitude] = useState(address?.latitude || '');
  const [longitude, setLongitude] = useState(address?.longitude || '');

  const provinces = useRegions(`${REGION_API}/provinces.json`);
  const cities = useRegions(provinceId ? `${REGION_API}/regencies/${provinceId}.json` : null);
  const districts = useRegions(cityId ? `${REGION_API}/districts/${cityId}.json` : null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const action = isEdit ? updateAddress : createAddress;
    const result = await action(formData);

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
        <h3 className="font-semibold text-slate-800">
          {isEdit ? 'Edit Alamat' : 'Tambah Alamat Baru'}
        </h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {errors._form && <p className="text-red-500 text-sm">{errors._form[0]}</p>}

      {isEdit && <input type="hidden" name="id" value={address.id} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="recipientName" className="text-sm text-slate-600">Nama Penerima *</Label>
          <Input id="recipientName" name="recipientName" required defaultValue={address?.recipientName} placeholder="Nama lengkap" className="mt-1" />
          {errors.recipientName && <p className="text-red-500 text-xs mt-1">{errors.recipientName[0]}</p>}
        </div>
        <div>
          <Label htmlFor="phone" className="text-sm text-slate-600">No. HP *</Label>
          <Input id="phone" name="phone" required defaultValue={address?.phone} placeholder="08xxxxxxxxxx" className="mt-1" />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone[0]}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="address" className="text-sm text-slate-600">Alamat Lengkap *</Label>
        <Textarea id="address" name="address" required rows={2} defaultValue={address?.address} placeholder="Jalan, RT/RW, No. Rumah..." className="mt-1" />
        {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address[0]}</p>}
      </div>

      <div>
        <Label htmlFor="detail" className="text-sm text-slate-600">Detail Tambahan</Label>
        <Input id="detail" name="detail" defaultValue={address?.detail || ''} placeholder="Patokan, warna rumah, dll." className="mt-1" />
      </div>

      {/* Map Picker */}
      <div>
        <Label className="text-sm text-slate-600">Pin Lokasi di Peta</Label>
        <div className="mt-1">
          <MapPicker
            defaultLat={address?.latitude ? parseFloat(address.latitude) : undefined}
            defaultLng={address?.longitude ? parseFloat(address.longitude) : undefined}
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
          label="Provinsi" name="province"
          options={provinces.data} loading={provinces.loading}
          value={provinceId}
          onChange={(id) => { setProvinceId(id); setCityId(''); setDistrictId(''); }}
          error={errors.province}
        />
        <RegionSelect
          label="Kota/Kabupaten" name="city"
          options={cities.data} loading={cities.loading}
          value={cityId} disabled={!provinceId}
          onChange={(id) => { setCityId(id); setDistrictId(''); }}
          error={errors.city}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RegionSelect
          label="Kecamatan" name="district"
          options={districts.data} loading={districts.loading}
          value={districtId} disabled={!cityId}
          onChange={(id) => setDistrictId(id)}
          error={errors.district}
        />
        <div>
          <Label htmlFor="postalCode" className="text-sm text-slate-600">Kode Pos *</Label>
          <Input id="postalCode" name="postalCode" required defaultValue={address?.postalCode} placeholder="12160" className="mt-1" />
          {errors.postalCode && <p className="text-red-500 text-xs mt-1">{errors.postalCode[0]}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="label" className="text-sm text-slate-600">Label</Label>
        <Input id="label" name="label" defaultValue={address?.label || ''} placeholder="Rumah, Kantor, dll." className="mt-1" />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="isDefault" name="isDefault" defaultChecked={address?.isDefault ?? false} className="rounded border-slate-300" />
        <Label htmlFor="isDefault" className="text-sm text-slate-600 cursor-pointer">Jadikan alamat utama</Label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Batal</Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Menyimpan...</>
          ) : (
            isEdit ? 'Simpan Perubahan' : 'Simpan Alamat'
          )}
        </Button>
      </div>
    </form>
  );
}

// ─── Address Card ──────────────────────────────────────────
function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white relative">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-slate-800">{address.recipientName}</span>
            {address.isDefault && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Default</span>
            )}
            {address.label && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{address.label}</span>
            )}
          </div>
          <p className="text-sm text-slate-600">{address.phone}</p>
          <p className="text-sm text-slate-500 mt-1">{address.address}</p>
          {address.detail && <p className="text-sm text-slate-400">{address.detail}</p>}
          <p className="text-xs text-slate-400 mt-1">
            {address.district}, {address.city}, {address.province} {address.postalCode}
          </p>
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-lg border border-slate-200 py-1 w-44">
                <button
                  onClick={() => { setMenuOpen(false); onEdit(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Alamat
                </button>
                {!address.isDefault && (
                  <button
                    onClick={() => { setMenuOpen(false); onSetDefault(); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Star className="w-3.5 h-3.5" />
                    Jadikan Default
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
          <p className="text-sm text-red-700 mb-2">Yakin hapus alamat ini?</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Batal</Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>Hapus</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────
export function AddressManager({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  async function refreshAddresses() {
    const fresh = await getUserAddresses();
    setAddresses(fresh);
  }

  async function handleDelete(id: number) {
    await deleteAddress(id);
    await refreshAddresses();
  }

  async function handleSetDefault(id: number) {
    await setDefaultAddress(id);
    await refreshAddresses();
  }

  if (mode === 'add' || mode === 'edit') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
        <AddressForm
          address={mode === 'edit' ? editingAddress! : undefined}
          onSuccess={async () => {
            await refreshAddresses();
            setMode('list');
            setEditingAddress(null);
          }}
          onCancel={() => { setMode('list'); setEditingAddress(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {addresses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <MapPin className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-600 font-medium">Belum ada alamat tersimpan</p>
          <p className="text-sm text-slate-400 mt-1 mb-5">Tambahkan alamat pengiriman pertama Anda</p>
          <Button onClick={() => setMode('add')}>
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Alamat
          </Button>
        </div>
      ) : (
        <>
          {addresses.map((addr) => (
            <AddressCard
              key={addr.id}
              address={addr}
              onEdit={() => { setEditingAddress(addr); setMode('edit'); }}
              onDelete={() => handleDelete(addr.id)}
              onSetDefault={() => handleSetDefault(addr.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => setMode('add')}
            className="w-full p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-primary"
          >
            <Plus className="w-4 h-4" />
            Tambah Alamat Baru
          </button>
        </>
      )}
    </div>
  );
}
