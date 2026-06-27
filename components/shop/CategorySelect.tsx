'use client';

interface Category {
  id: number;
  slug: string;
  name: string;
}

export function CategorySelect({ categories, currentCategory }: { categories: Category[]; currentCategory?: string }) {
  return (
    <select
      defaultValue={currentCategory || ''}
      onChange={(e) => {
        const url = e.target.value
          ? `/products?category=${e.target.value}`
          : '/products';
        window.location.href = url;
      }}
      className="w-full px-4 py-2 border border-slate-200 rounded-lg"
    >
      <option value="">Semua Kategori</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.slug}>{cat.name}</option>
      ))}
    </select>
  );
}
