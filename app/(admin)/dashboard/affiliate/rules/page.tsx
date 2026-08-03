// app/(admin)/dashboard/affiliate/rules/page.tsx
import { getCommissionRules } from '@/app/actions/affiliate';
import { getActiveProducts, getCategories } from '@/app/actions/products';
import { RuleForm } from './RuleForm';
import { RulesList } from './RulesList';

export default async function AdminAffiliateRulesPage() {
  const [rules, categories, products] = await Promise.all([
    getCommissionRules(),
    getCategories(),
    getActiveProducts({ limit: 200 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Aturan Komisi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resolusi: product &gt; category &gt; tier &gt; global default</p>
        </div>
        <RuleForm categories={categories} products={products} />
      </div>

      <RulesList rules={rules} />
    </div>
  );
}
