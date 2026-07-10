// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: [
        'onetone.kanuraga.web.id',
        'localhost:3000',
      ],
      bodySizeLimit: '5mb',
    },
  },
  images: {
    
    remotePatterns: [
      // Unsplash
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'unsplash.com',
      },
      // Cloudinary (untuk upload produk & banner)
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      // Google avatar (NextAuth Google provider)
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // GitHub avatar (NextAuth GitHub provider)
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      // Placeholder & testing
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      // Cloudflare R2 (CDN)
      {
        protocol: "https",
        hostname: "pub-5773464375cb4608b5f31ee707c465e8.r2.dev",
      },
      // opsional: kalau nanti pakai custom domain CDN sendiri
      // { protocol: "https", hostname: "cdn.onetone-store.com" },
    ],
  },
};

export default nextConfig;
