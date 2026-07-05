import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProductBySlug, getActiveProducts } from '@/app/actions/products';
import { getProductVariants } from '@/app/actions/product-variants';
import { getProductImages } from '@/app/actions/product-images';
import { formatRupiah } from '@/lib/utils';
import { ProductDetail } from './ProductDetail';
import { ProductCard } from '@/components/shop/ProductCard';
import { Truck, Shield } from 'lucide-react';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [variants, images, relatedProducts] = await Promise.all([
    getProductVariants(product.id, true),
    getProductImages(product.id),
    getActiveProducts({ categorySlug: product.category?.slug, limit: 5 }),
  ]);

  const related = relatedProducts.filter((p) => p.id !== product.id).slice(0, 4);
  const hasVariants = variants.length > 0;
  const initialStock = hasVariants ? 0 : (product.stock ?? 0);

  // Map ke shape GalleryImage, fallback ke products.image jika belum ada R2 images
  const galleryImages = images.length > 0
    ? images.map((img) => ({
        id: img.id,
        url: img.url,
        thumbUrl: img.thumbUrl,
        isPrimary: img.isPrimary ?? false,
        variantColor: img.variantColor ?? null,
      }))
    : product.image
      ? [{ id: 0, url: product.image, thumbUrl: null, isPrimary: true, variantColor: null }]
      : [];

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

      {/* Product Detail — gallery + variant selector share selectedColor state */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <ProductDetail
          productId={product.id}
          basePrice={parseFloat(String(product.price))}
          variants={variants}
          initialStock={initialStock}
          images={galleryImages}
          productName={product.name}
        />

        {/* Info */}
        <div>
          <p className="text-sm text-primary mb-2">{product.category?.name}</p>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">{product.name}</h1>

          <div className="prose prose-sm text-slate-600 mb-6">
            <p>{product.description || 'Tidak ada deskripsi.'}</p>
          </div>

          {/* Harga (static fallback — price dinamis ada di AddToCartButton) */}
          <p className="text-2xl font-bold text-primary mb-6">
            {formatRupiah(parseFloat(String(product.price)))}
          </p>

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
