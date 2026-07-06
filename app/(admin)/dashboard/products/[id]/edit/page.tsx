import { getProduct, getCategories } from '@/app/actions/products';
import { getProductVariants, getVariantIdsUsedInOrders, getVariantIdsUsedInCarts } from '@/app/actions/product-variants';
import { getProductImages } from '@/app/actions/product-images';
import { ProductForm } from '../../_components/ProductForm';
import { ProductImageUploader } from '@/components/admin/ProductImageUploader';
import { GoogleDrivePicker } from '@/components/admin/GoogleDrivePicker';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const productId = Number(id);

  const [product, categories, variants, images, usedInOrderIds, usedInCartIds] = await Promise.all([
    getProduct(productId),
    getCategories(),
    getProductVariants(productId),
    getProductImages(productId),
    getVariantIdsUsedInOrders(productId),
    getVariantIdsUsedInCarts(productId),
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
        <ProductForm product={product} categories={categories} variants={variants} usedInOrderIds={usedInOrderIds} usedInCartIds={usedInCartIds} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Foto Produk</h2>
            <GoogleDrivePicker productId={productId} />
          </div>
          <ProductImageUploader
            productId={productId}
            initialImages={images}
            variantColors={[...new Set(variants.map((v) => v.color).filter(Boolean))] as string[]}
          />
        </div>
      </div>
    </div>
  );
}
