import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  selectQueue: [] as unknown[],
  insertError: false,
  updateError: false,
  upload: vi.fn(async (key: string) => ({ objectKey: key, url: `https://cdn.example.com/${key}`, filesize: 100, checksum: 'checksum' })),
  remove: vi.fn(async () => undefined),
  generateKey: vi.fn((folder: string, ext: string) => `${folder}/generated.${ext}`),
  processBannerImage: vi.fn(async (buffer: Buffer, crop?: unknown) => {
    void crop;
    return {
      original: { buffer, width: 1500, height: 500, format: 'png', filesize: buffer.length },
      main: { buffer, width: 1500, height: 500, filesize: buffer.length },
      thumb: { buffer, width: 480, height: 160, filesize: buffer.length },
    };
  }),
}));

function chain(value: unknown, reject = false) {
  const query: Record<string, unknown> = {};
  for (const method of ['from', 'where', 'limit', 'orderBy', 'set']) query[method] = vi.fn().mockReturnValue(query);
  query.values = vi.fn().mockReturnValue(query);
  query.then = (resolve: (result: unknown) => unknown, rejectPromise: (error: Error) => unknown) =>
    reject ? rejectPromise(new Error('database failed')) : resolve(value);
  return query;
}

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => chain(mocks.selectQueue.shift() ?? [])),
    insert: vi.fn(() => chain([], mocks.insertError)),
    update: vi.fn(() => chain([], mocks.updateError)),
    delete: vi.fn(() => chain([])),
  },
}));
vi.mock('@/lib/storage', () => ({
  storage: { upload: mocks.upload, delete: mocks.remove, getUrl: (key: string) => `https://cdn.example.com/${key}` },
  generateObjectKey: mocks.generateKey,
}));
vi.mock('@/lib/image-processor', () => ({
  detectMimeFromBuffer: vi.fn(() => 'image/png'),
  processBannerImage: mocks.processBannerImage,
}));

import { createBanner, deleteBanner, updateBanner } from '@/app/actions/banners';
import { db } from '@/lib/db';

describe('banner actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.insertError = false;
    mocks.updateError = false;
    mocks.auth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
  });

  it('rejects non-admin users before accessing storage or database', async () => {
    mocks.auth.mockResolvedValue({ user: { id: '2', role: 'customer' } });
    const result = await createBanner(null, new FormData());
    expect(result).toEqual({ success: false, errors: { _form: ['Unauthorized'] } });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('requires an upload or a supported legacy URL', async () => {
    const data = new FormData();
    data.set('title', 'Promo akhir pekan');
    const result = await createBanner(null, data);
    expect(result).toEqual({ success: false, errors: { image: ['Upload gambar banner atau isi URL eksternal'] } });
  });

  it('cleans newly uploaded files when the database insert fails', async () => {
    mocks.insertError = true;
    const data = new FormData();
    data.set('title', 'Promo akhir pekan');
    data.set('imageFile', new File([new Uint8Array([1, 2, 3])], 'banner.png', { type: 'image/png' }));

    const result = await createBanner(null, data);

    expect(result?.success).toBe(false);
    expect(mocks.upload).toHaveBeenCalledTimes(3);
    expect(mocks.remove).toHaveBeenCalledTimes(3);
  });

  it('passes the crop selected in the UI to image processing', async () => {
    const data = new FormData();
    data.set('title', 'Promo akhir pekan');
    data.set('imageFile', new File([new Uint8Array([1, 2, 3])], 'banner.png', { type: 'image/png' }));
    data.set('cropX', '120');
    data.set('cropY', '40');
    data.set('cropWidth', '900');
    data.set('cropHeight', '300');

    await expect(createBanner(null, data)).rejects.toThrow('NEXT_REDIRECT:/dashboard/banners');

    expect(mocks.processBannerImage).toHaveBeenCalledWith(expect.any(Buffer), {
      x: 120,
      y: 40,
      width: 900,
      height: 300,
    });
  });

  it('removes all owned R2 objects after deleting a banner record', async () => {
    mocks.selectQueue.push([{
      id: 7,
      image: '',
      imageObjectKey: 'banners/main.webp',
      imageObjectKeyOriginal: 'banners/original/source.png',
      imageObjectKeyThumb: 'banners/thumb/main.webp',
    }]);

    const result = await deleteBanner(7);

    expect(result).toEqual({ success: true });
    expect(db.delete).toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledTimes(3);
  });

  it('replaces an existing R2 image and cleans the old objects after a successful update', async () => {
    mocks.selectQueue.push([{
      id: 7,
      image: '',
      imageObjectKey: 'banners/old.webp',
      imageObjectKeyOriginal: 'banners/original/old.png',
      imageObjectKeyThumb: 'banners/thumb/old.webp',
    }]);
    const data = new FormData();
    data.set('title', 'Banner baru');
    data.set('imageFile', new File([new Uint8Array([1, 2, 3])], 'new.png', { type: 'image/png' }));

    await expect(updateBanner(7, null, data)).rejects.toThrow('NEXT_REDIRECT:/dashboard/banners');

    expect(db.update).toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith('banners/old.webp');
    expect(mocks.remove).toHaveBeenCalledWith('banners/original/old.png');
    expect(mocks.remove).toHaveBeenCalledWith('banners/thumb/old.webp');
  });
});
