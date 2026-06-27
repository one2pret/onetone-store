// app/(shop)/layout.tsx
import { auth } from '@/lib/auth';
import { getCartCount } from '@/app/actions/cart';
import { getCategories } from '@/app/actions/products';
import { Navbar } from '@/components/shop/Navbar';
import { Footer } from '@/components/shop/Footer';

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const [cartCount, categories] = await Promise.all([
    session ? getCartCount() : Promise.resolve(0),
    getCategories(),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={session?.user} cartCount={cartCount} categories={categories} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
