import type { Banner } from "@/lib/db/schema";
import { storage } from "@/lib/storage";

const EXTERNAL_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "unsplash.com",
  "res.cloudinary.com",
  "placehold.co",
]);

type BannerImageSource = Pick<Banner, "image" | "imageObjectKey">;

export function isAllowedExternalBannerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    let cdnHostname = "";
    try {
      cdnHostname = process.env.NEXT_PUBLIC_CDN_URL ? new URL(process.env.NEXT_PUBLIC_CDN_URL).hostname : "";
    } catch {
      // Konfigurasi CDN yang tidak valid tidak boleh melonggarkan allowlist URL eksternal.
    }
    return url.protocol === "https:" && (EXTERNAL_IMAGE_HOSTS.has(url.hostname) || url.hostname === cdnHostname);
  } catch {
    return false;
  }
}

export function resolveBannerImageUrl(banner: BannerImageSource): string {
  if (banner.imageObjectKey) return storage.getUrl(banner.imageObjectKey);
  return banner.image;
}

export function withResolvedBannerImage<T extends BannerImageSource>(banner: T): T {
  return { ...banner, image: resolveBannerImageUrl(banner) };
}

export function toPublicBanner(banner: Banner) {
  return {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    image: resolveBannerImageUrl(banner),
    link: banner.link,
    isActive: banner.isActive,
    sortOrder: banner.sortOrder,
  };
}
