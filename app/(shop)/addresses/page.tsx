// app/(shop)/addresses/page.tsx
import { getUserAddresses } from '@/app/actions/addresses';
import { AddressManager } from './_components/AddressManager';

export default async function AddressesPage() {
  const addresses = await getUserAddresses();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Alamat Saya</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola alamat pengiriman Anda</p>
      </div>
      <AddressManager initialAddresses={addresses} />
    </div>
  );
}
