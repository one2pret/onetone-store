// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
