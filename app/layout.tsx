import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

const baloo2 = localFont({
  src: "./fonts/baloo-2-latin.woff2",
  variable: "--font-baloo",
  weight: "700 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ONETONE Store — Sportswear Premium Indonesia",
    template: "%s | ONETONE Store",
  },
  description: "ONETONE Store — Sportswear Premium Indonesia. Koleksi fashion sport terbaik, dikirim ke seluruh Indonesia.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${baloo2.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
