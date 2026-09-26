'use server';

import { auth } from '@/lib/auth';
import { withResolvedBannerImage, isAllowedExternalBannerUrl, toPublicBanner } from '@/lib/banner-images';
import { db } from '@/lib/db';
import { banners } from '@/lib/db/schema';
import { detectMimeFromBuffer, processBannerImage, type BannerCropArea } from '@/lib/image-processor';
import { generateObjectKey, storage } from '@/lib/storage';
import { asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const optionalExternalUrl = z.string().trim().max(500).optional().refine(
  value => !value || isAllowedExternalBannerUrl(value),
  'Gunakan URL HTTPS langsung dari Unsplash, Cloudinary, atau placehold.co',
);

const optionalLink = z.string().trim().max(500).optional().refine(value => {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}, 'Link harus berupa path internal atau URL HTTPS');

const bannerSchema = z.object({
  title: z.string().trim().min(1, 'Judul banner wajib diisi').max(255),
  subtitle: z.string().trim().max(500).optional(),
  externalImageUrl: optionalExternalUrl,
  link: optionalLink,
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().default(0),
});

const bannerCropSchema = z.object({
  x: z.coerce.number().finite().min(0),
  y: z.coerce.number().finite().min(0),
  width: z.coerce.number().finite().positive(),
  height: z.coerce.number().finite().positive(),
});

type UploadedBannerImage = {
  objectKey: string;
  originalObjectKey: string;
  thumbObjectKey: string;
  mime: string;
  width: number;
  height: number;
  filesize: number;
  checksum: string;
};

function formValues(formData: FormData) {
  return {
    title: formData.get('title'),
    subtitle: String(formData.get('subtitle') ?? '').trim() || undefined,
    externalImageUrl: String(formData.get('externalImageUrl') ?? '').trim() || undefined,
    link: String(formData.get('link') ?? '').trim() || undefined,
    isActive: formData.get('isActive') === 'on',
    sortOrder: formData.get('sortOrder') || 0,
  };
}

function selectedImageFile(formData: FormData) {
  const value = formData.get('imageFile');
  return value instanceof File && value.size > 0 ? value : null;
}

function selectedCropArea(formData: FormData): BannerCropArea | undefined {
  const raw = {
    x: formData.get('cropX'),
    y: formData.get('cropY'),
    width: formData.get('cropWidth'),
    height: formData.get('cropHeight'),
  };
  if (Object.values(raw).every(value => value === null || value === '')) return undefined;

  const parsed = bannerCropSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Area crop banner tidak valid. Atur ulang posisi gambar lalu coba lagi.');
  return parsed.data;
}

async function deleteStoredBannerImage(image: {
  imageObjectKey: string | null;
  imageObjectKeyOriginal: string | null;
  imageObjectKeyThumb: string | null;
}) {
  const keys = [image.imageObjectKey, image.imageObjectKeyOriginal, image.imageObjectKeyThumb]
    .filter((key): key is string => Boolean(key));
  await Promise.allSettled(keys.map(key => storage.delete(key)));
}

async function uploadBannerImage(file: File, crop?: BannerCropArea): Promise<UploadedBannerImage> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectMimeFromBuffer(buffer);
  const processed = await processBannerImage(buffer, crop);
  const originalExt = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/heic' ? 'heic' : 'jpg';
  const objectKey = generateObjectKey('banners', 'webp');
  const thumbObjectKey = generateObjectKey('banners/thumb', 'webp');
  const originalObjectKey = generateObjectKey('banners/original', originalExt);

  try {
    const [main] = await Promise.all([
      storage.upload(objectKey, processed.main.buffer, 'image/webp'),
      storage.upload(thumbObjectKey, processed.thumb.buffer, 'image/webp'),
      storage.upload(originalObjectKey, processed.original.buffer, mime),
    ]);
    return {
      objectKey,
      originalObjectKey,
      thumbObjectKey,
      mime: 'image/webp',
      width: processed.main.width,
      height: processed.main.height,
      filesize: processed.main.filesize,
      checksum: main.checksum,
    };
  } catch (error) {
    await Promise.allSettled([
      storage.delete(objectKey),
      storage.delete(thumbObjectKey),
      storage.delete(originalObjectKey),
    ]);
    throw error;
  }
}

function uploadValues(uploaded: UploadedBannerImage) {
  return {
    image: '',
    imageObjectKey: uploaded.objectKey,
    imageObjectKeyOriginal: uploaded.originalObjectKey,
    imageObjectKeyThumb: uploaded.thumbObjectKey,
    imageMime: uploaded.mime,
    imageWidth: uploaded.width,
    imageHeight: uploaded.height,
    imageFilesize: uploaded.filesize,
    imageChecksum: uploaded.checksum,
  };
}

function externalImageValues(image: string) {
  return {
    image,
    imageObjectKey: null,
    imageObjectKeyOriginal: null,
    imageObjectKeyThumb: null,
    imageMime: null,
    imageWidth: null,
    imageHeight: null,
    imageFilesize: null,
    imageChecksum: null,
  };
}

function revalidateBanners() {
  revalidatePath('/dashboard/banners');
  revalidatePath('/');
}

export async function getActiveBanners() {
  const rows = await db.select()
    .from(banners)
    .where(eq(banners.isActive, true))
    .orderBy(asc(banners.sortOrder));
  return rows
    .filter(row => row.imageObjectKey || isAllowedExternalBannerUrl(row.image))
    .map(toPublicBanner);
}

export async function getAllBanners() {
  const rows = await db.select().from(banners).orderBy(asc(banners.sortOrder));
  return rows.map(withResolvedBannerImage);
}

export async function getBanner(id: number) {
  const rows = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
  return rows[0] ? withResolvedBannerImage(rows[0]) : null;
}

export async function createBanner(prevState: unknown, formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return { success: false, errors: { _form: ['Unauthorized'] } };
  }

  const file = selectedImageFile(formData);
  const values = formValues(formData);
  if (file) values.externalImageUrl = undefined;
  const validated = bannerSchema.safeParse(values);
  if (!validated.success) return { success: false, errors: validated.error.flatten().fieldErrors };

  if (!file && !validated.data.externalImageUrl) {
    return { success: false, errors: { image: ['Upload gambar banner atau isi URL eksternal'] } };
  }

  let uploaded: UploadedBannerImage | null = null;
  try {
    if (file) uploaded = await uploadBannerImage(file, selectedCropArea(formData));
  } catch (error) {
    return { success: false, errors: { image: [error instanceof Error ? error.message : 'Gagal memproses gambar banner'] } };
  }

  try {
    const { externalImageUrl, ...data } = validated.data;
    await db.insert(banners).values({
      ...data,
      ...(uploaded ? uploadValues(uploaded) : externalImageValues(externalImageUrl!)),
    });
  } catch {
    if (uploaded) await deleteStoredBannerImage({
      imageObjectKey: uploaded.objectKey,
      imageObjectKeyOriginal: uploaded.originalObjectKey,
      imageObjectKeyThumb: uploaded.thumbObjectKey,
    });
    return { success: false, errors: { _form: ['Gagal membuat banner. Coba lagi.'] } };
  }

  revalidateBanners();
  redirect('/dashboard/banners');
}

export async function updateBanner(id: number, prevState: unknown, formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== 'admin') {
    return { success: false, errors: { _form: ['Unauthorized'] } };
  }

  const file = selectedImageFile(formData);
  const values = formValues(formData);
  if (file) values.externalImageUrl = undefined;
  const validated = bannerSchema.safeParse(values);
  if (!validated.success) return { success: false, errors: validated.error.flatten().fieldErrors };

  const existingRows = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing) return { success: false, errors: { _form: ['Banner tidak ditemukan'] } };

  const hasExistingImage = Boolean(existing.imageObjectKey || isAllowedExternalBannerUrl(existing.image));
  if (!file && !validated.data.externalImageUrl && !hasExistingImage) {
    return { success: false, errors: { image: ['Upload gambar banner atau isi URL eksternal'] } };
  }

  let uploaded: UploadedBannerImage | null = null;
  const switchingToExternal = !file && Boolean(validated.data.externalImageUrl) && validated.data.externalImageUrl !== existing.image;
  try {
    if (file) uploaded = await uploadBannerImage(file, selectedCropArea(formData));
  } catch (error) {
    return { success: false, errors: { image: [error instanceof Error ? error.message : 'Gagal memproses gambar banner'] } };
  }

  try {
    const { externalImageUrl, ...data } = validated.data;
    await db.update(banners).set({
      ...data,
      ...(uploaded
        ? uploadValues(uploaded)
        : switchingToExternal
          ? externalImageValues(externalImageUrl!)
          : {}),
    }).where(eq(banners.id, id));
  } catch {
    if (uploaded) await deleteStoredBannerImage({
      imageObjectKey: uploaded.objectKey,
      imageObjectKeyOriginal: uploaded.originalObjectKey,
      imageObjectKeyThumb: uploaded.thumbObjectKey,
    });
    return { success: false, errors: { _form: ['Gagal memperbarui banner. Coba lagi.'] } };
  }

  if (uploaded || switchingToExternal) await deleteStoredBannerImage(existing);
  revalidateBanners();
  redirect('/dashboard/banners');
}

export async function deleteBanner(id: number) {
  const session = await auth();
  if (session?.user?.role !== 'admin') return { success: false, error: 'Unauthorized' };

  try {
    const rows = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
    const existing = rows[0];
    if (!existing) return { success: false, error: 'Banner tidak ditemukan' };
    await db.delete(banners).where(eq(banners.id, id));
    await deleteStoredBannerImage(existing);
    revalidateBanners();
    return { success: true };
  } catch {
    return { success: false, error: 'Gagal hapus banner' };
  }
}
