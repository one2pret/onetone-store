// app/(marketplace)/account/profile/page.tsx
import { getMyProfile } from '@/app/actions/profile';
import { notFound } from 'next/navigation';
import { ProfileForm } from './ProfileForm';

export default async function ProfilePage() {
  const profile = await getMyProfile();
  if (!profile) notFound();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Profil Saya</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola informasi akun kamu</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 md:p-6">
        <ProfileForm
          name={profile.name}
          email={profile.email}
          phone={profile.phone}
        />
      </div>
    </div>
  );
}
