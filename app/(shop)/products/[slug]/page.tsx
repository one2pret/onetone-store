// app/(shop)/products/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getProductBySlug, getActiveProducts } from '@/app/actions/products';
import { formatRupiah } from '@/lib/utils';
import { AddToCartButton } from './AddToCartButton';
import { ProductCard } from '@/components/shop/ProductCard';
import { ShoppingBag, Truck, Shield } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // Get related products
  const relatedProducts = await getActiveProducts({
    categorySlug: product.category?.slug,
    limit: 4,
  });

  const related = relatedProducts.filter(p => p.id !== product.id).slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-primary">Produk</Link>
        <span>/</span>
        <span className="text-slate-800">{product.name}</span>
      </nav>

      {/* Product Detail */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Image */}
        <div className="aspect-square bg-slate-100 rounded-xl relative overflow-hidden">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-24 h-24 text-slate-300" />
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-sm text-primary mb-2">{product.category?.name}</p>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">{product.name}</h1>

          <div className="text-3xl font-bold text-primary mb-6">
            {formatRupiah(product.price)}
          </div>

          <div className="prose prose-sm text-slate-600 mb-6">
            <p>{product.description || 'Tidak ada deskripsi.'}</p>
          </div>

          {/* Stock Info */}
          <div className="mb-6">
            {product.stock !== null && product.stock > 0 ? (
              <p className="text-green-600">
                ✓ Stok tersedia ({product.stock} pcs)
              </p>
            ) : (
              <p className="text-red-600">✗ Stok habis</p>
            )}
          </div>

          {/* Add to Cart */}
          <div className="mb-8">
            <AddToCartButton
              productId={product.id}
              disabled={!product.stock || product.stock <= 0}
            />
          </div>

          {/* Features */}
          <div className="border-t border-slate-100 pt-6 space-y-3">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Truck className="w-5 h-5 text-primary" />
              <span>Pengiriman ke seluruh Indonesia</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Shield className="w-5 h-5 text-primary" />
              <span>Produk 100% original</span>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-slate-800 mb-6">Produk Serupa</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
