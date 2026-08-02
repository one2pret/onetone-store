// app/(marketplace)/affiliate/dashboard/links/page.tsx
import { getMyLinks } from '@/app/actions/affiliate';
import { getActiveProducts, getCategories } from '@/app/actions/products';
import { LinksManager } from './LinksManager';

export default async function AffiliateLinksPage() {
  const [links, products, categories] = await Promise.all([
    getMyLinks(),
    getActiveProducts({ limit: 200 }),
    getCategories(),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Link Saya</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Buat dan kelola link referral untuk dibagikan</p>
      </div>

      <LinksManager links={links} products={products} categories={categories} baseUrl={baseUrl} />
    </div>
  );
}
