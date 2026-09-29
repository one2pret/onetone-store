import { describe, expect, it } from 'vitest';
import { parseBrowserLocalDateTime } from '@/lib/browser-local-datetime';

describe('parseBrowserLocalDateTime', () => {
  it('converts WIB browser time to UTC independently of the server timezone', () => {
    const result = parseBrowserLocalDateTime('2026-09-28T16:40', -420);

    expect(result.toISOString()).toBe('2026-09-28T09:40:00.000Z');
  });

  it('supports UTC and timezones west of UTC', () => {
    expect(parseBrowserLocalDateTime('2026-09-28T16:40', 0).toISOString())
      .toBe('2026-09-28T16:40:00.000Z');
    expect(parseBrowserLocalDateTime('2026-09-28T16:40', 420).toISOString())
      .toBe('2026-09-28T23:40:00.000Z');
  });

  it('rejects invalid calendar values and timezone offsets', () => {
    expect(() => parseBrowserLocalDateTime('2026-02-30T10:00', -420)).toThrow(RangeError);
    expect(() => parseBrowserLocalDateTime('2026-09-28T10:00', 900)).toThrow(RangeError);
  });
});
