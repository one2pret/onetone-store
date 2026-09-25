import { getProduct, getCategories, getProductBarcodes } from '@/app/actions/products';
import { getProductVariants, getVariantIdsUsedInOrders, getVariantIdsUsedInCarts } from '@/app/actions/product-variants';
import { getProductImages } from '@/app/actions/product-images';
import { ProductForm } from '../../_components/ProductForm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const productId = Number(id);

  const [product, categories, variants, images, usedInOrderIds, usedInCartIds, barcodes] = await Promise.all([
    getProduct(productId),
    getCategories(),
    getProductVariants(productId),
    getProductImages(productId),
    getVariantIdsUsedInOrders(productId),
    getVariantIdsUsedInCarts(productId),
    getProductBarcodes(productId),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Edit Produk</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{product.name}</p>
      </div>

      <div className="max-w-2xl space-y-8">
        <ProductForm
          product={product}
          categories={categories}
          variants={variants}
          images={images}
          usedInOrderIds={usedInOrderIds}
          usedInCartIds={usedInCartIds}
          primaryImageUrl={images.find(img => img.isPrimary)?.url ?? images[0]?.url}
          barcodes={barcodes}
        />
      </div>
    </div>
  );
}
