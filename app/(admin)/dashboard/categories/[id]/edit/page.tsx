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

  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/categories"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Edit Kategori</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{category.name}</p>
      </div>

      <div className="max-w-2xl">
        <CategoryForm category={category} />
      </div>
    </div>
  );
}
