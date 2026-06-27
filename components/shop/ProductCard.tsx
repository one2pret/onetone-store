// components/shop/ProductCard.tsx
import Link from 'next/link';
import Image from 'next/image';
import { formatRupiah } from '@/lib/utils';
import { ShoppingBag } from 'lucide-react';
import type { ProductWithCategory } from '@/lib/db/schema';

interface ProductCardProps {
  product: ProductWithCategory;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group bg-white rounded-xl overflow-hidden border border-slate-100 hover:shadow-lg hover:border-primary/30 transition-all duration-200 hover:scale-[1.02]"
    >
      {/* Image */}
      <div className="aspect-square bg-slate-100 relative overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <ShoppingBag className="w-8 h-8 md:w-12 md:h-12 text-slate-300" />
          </div>
        )}
        {product.isFeatured && (
          <span className="absolute top-1.5 left-1.5 md:top-2 md:left-2 px-1.5 md:px-2 py-0.5 md:py-1 bg-orange-500 text-white text-[10px] md:text-xs font-medium rounded">
            Unggulan
          </span>
        )}
        {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
          <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 px-1.5 md:px-2 py-0.5 md:py-1 bg-red-500 text-white text-[10px] md:text-xs font-medium rounded">
            Sisa {product.stock}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 md:p-4">
        <p className="text-[10px] md:text-xs text-slate-500 mb-0.5 md:mb-1">{product.category?.name}</p>
        <h3 className="font-medium text-xs md:text-sm text-slate-800 mb-1 md:mb-2 line-clamp-2 leading-snug group-hover:text-primary transition">
          {product.name}
        </h3>
        <p className="text-sm md:text-lg font-bold text-primary">
          {formatRupiah(product.price)}
        </p>
      </div>
    </Link>
  );
}
