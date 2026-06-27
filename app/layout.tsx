// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NextElektronik - Online Shop',
  description: 'Toko elektronik online terpercaya — produk berkualitas, harga terbaik, pengiriman cepat ke seluruh Indonesia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <NuqsAdapter>
          {children}
        </NuqsAdapter>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
