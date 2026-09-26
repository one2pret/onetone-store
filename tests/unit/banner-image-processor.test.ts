import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { processBannerImage } from '@/lib/image-processor';

describe('processBannerImage', () => {
  it('creates optimized 3:1 main and thumbnail images', async () => {
    const source = await sharp({
      create: { width: 1500, height: 700, channels: 3, background: '#8b7355' },
    }).png().toBuffer();

    const result = await processBannerImage(source);

    expect(result.main.width / result.main.height).toBe(3);
    expect(result.thumb).toMatchObject({ width: 480, height: 160 });
    expect(result.original.buffer).toEqual(source);
    expect(result.main.filesize).toBeGreaterThan(0);
  });

  it('rejects a payload that is not an image', async () => {
    await expect(processBannerImage(Buffer.from('not an image'))).rejects.toThrow('Format file tidak didukung');
  });

  it('rejects files larger than 10 MB before processing', async () => {
    await expect(processBannerImage(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow('melebihi batas 10MB');
  });
});
