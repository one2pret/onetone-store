'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { registerAffiliate } from '@/app/actions/affiliate';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await registerAffiliate(null, formData);
      if (!result.success) {
        setError(result.error ?? 'Gagal mendaftar');
        toast.error(result.error ?? 'Gagal mendaftar');
        return;
      }
      toast.success('Pendaftaran terkirim, menunggu review admin');
      router.push('/affiliate/dashboard');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="displayName">Nama publik</Label>
        <Input id="displayName" name="displayName" required placeholder="Nama yang tampil di link/promosi" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="instagram">Instagram</Label>
          <Input id="instagram" name="instagram" placeholder="@username" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tiktok">TikTok</Label>
          <Input id="tiktok" name="tiktok" placeholder="@username" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="youtube">YouTube</Label>
          <Input id="youtube" name="youtube" placeholder="Nama channel" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="audienceSize">Perkiraan jumlah audiens/followers</Label>
        <Input id="audienceSize" name="audienceSize" type="number" min={0} placeholder="1000" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="motivation">Kenapa mau jadi affiliate Onetone?</Label>
        <Textarea id="motivation" name="motivation" rows={3} placeholder="Ceritakan singkat rencana promosimu" />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Mengirim...' : 'Kirim Pendaftaran'}
      </Button>
    </form>
  );
}
