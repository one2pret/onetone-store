import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProductBySlug, getActiveProducts } from '@/app/actions/products';
import { getProductVariants } from '@/app/actions/product-variants';
import { getProductImages } from '@/app/actions/product-images';
import { ProductDetail } from './ProductDetail';
import { ProductCard } from '@/components/shop/ProductCard';

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
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-foreground transition-colors">Produk</Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[200px]">{product.name}</span>
      </nav>

      {/* Product Detail — full 2-column layout inside, shares selectedColor state */}
      <ProductDetail
        productId={product.id}
        productName={product.name}
        categoryName={product.category?.name}
        categorySlug={product.category?.slug}
        description={product.description}
        basePrice={parseFloat(String(product.price))}
        variants={variants}
        initialStock={initialStock}
        images={galleryImages}
      />

      {/* Related Products */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-foreground mb-6">Produk Serupa</h2>
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
