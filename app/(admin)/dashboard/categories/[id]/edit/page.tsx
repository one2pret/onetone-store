// app/(admin)/dashboard/categories/[id]/edit/page.tsx
import { getCategory } from '@/app/actions/categories';
import { CategoryForm } from '../../_components/CategoryForm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;
  const category = await getCategory(Number(id));

  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/categories"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Edit Kategori</h1>
        <p className="text-sm text-slate-500 mt-0.5">{category.name}</p>
      </div>

      <div className="max-w-2xl bg-white rounded-xl border border-slate-200/60 shadow-sm p-5 md:p-6">
        <CategoryForm category={category} />
      </div>
    </div>
  );
}
