import { describe, it, expect } from 'vitest';
import {
  cn,
  formatRupiah,
  formatDate,
  generateOrderNumber,
  slugify,
  getStatusColor,
  getStatusLabel,
} from '@/lib/utils';

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('merges conflicting Tailwind classes', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });
});

describe('formatRupiah()', () => {
  it('formats number to Rupiah', () => {
    const result = formatRupiah(299000);
    expect(result).toContain('299');
    expect(result).toMatch(/Rp/);
  });

  it('formats string number', () => {
    const result = formatRupiah('850000');
    expect(result).toContain('850');
  });

  it('formats zero', () => {
    const result = formatRupiah(0);
    expect(result).toMatch(/Rp/);
    expect(result).toContain('0');
  });
});

describe('formatDate()', () => {
  it('formats Date object', () => {
    const date = new Date('2025-06-15T10:30:00Z');
    const result = formatDate(date);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('formats date string', () => {
    const result = formatDate('2025-01-01T00:00:00Z');
    expect(result).toBeTruthy();
  });
});

describe('generateOrderNumber()', () => {
  it('starts with ORD', () => {
    expect(generateOrderNumber()).toMatch(/^ORD/);
  });

  it('has correct length (ORD + 6 digits + 4 random)', () => {
    const num = generateOrderNumber();
    expect(num.length).toBe(13); // ORD(3) + YYMMDD(6) + RANDOM(4)
  });

  it('generates unique numbers', () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    expect(a).not.toBe(b);
  });
});

describe('slugify()', () => {
  it('converts to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Makanan & Minuman')).toBe('makanan-minuman');
  });

  it('handles multiple spaces', () => {
    expect(slugify('  hello   world  ')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

describe('getStatusColor()', () => {
  it('returns correct color for waiting_payment', () => {
    expect(getStatusColor('waiting_payment')).toContain('yellow');
  });

  it('returns correct color for packing', () => {
    expect(getStatusColor('packing')).toContain('blue');
  });

  it('returns correct color for delivered', () => {
    expect(getStatusColor('delivered')).toContain('green');
  });

  it('returns correct color for expired', () => {
    expect(getStatusColor('expired')).toContain('orange');
  });

  it('returns correct color for cancelled', () => {
    expect(getStatusColor('cancelled')).toContain('red');
  });

  it('returns gray for unknown status', () => {
    expect(getStatusColor('unknown')).toContain('gray');
  });
});

describe('getStatusLabel()', () => {
  it('returns Indonesian label for waiting_payment', () => {
    expect(getStatusLabel('waiting_payment')).toBe('Menunggu Pembayaran');
  });

  it('returns Indonesian label for packing', () => {
    expect(getStatusLabel('packing')).toBe('Dikemas');
  });

  it('returns Indonesian label for delivered', () => {
    expect(getStatusLabel('delivered')).toBe('Selesai');
  });

  it('returns Indonesian label for paid', () => {
    expect(getStatusLabel('paid')).toBe('Sudah Bayar');
  });

  it('returns raw status for unknown', () => {
    expect(getStatusLabel('unknown')).toBe('unknown');
  });
});
