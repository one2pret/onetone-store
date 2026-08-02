import { describe, it, expect, vi } from 'vitest';

// resolveRateFromRules & calculateCommission diuji di sini murni, tapi module
// commission.ts juga import '@/lib/db' (bikin koneksi pool saat load) — di-mock
// biar test gak butuh DATABASE_URL asli.
vi.mock('@/lib/db', () => ({ db: {} }));

import { resolveRateFromRules, calculateCommission } from '@/lib/affiliate/commission';
import type { CommissionRule } from '@/lib/db/schema';

const NOW = new Date('2026-08-02T00:00:00Z');

function makeRule(overrides: Partial<CommissionRule>): CommissionRule {
  return {
    id: 1,
    scope: 'global',
    scopeTier: null,
    categoryId: null,
    productId: null,
    ratePercent: '5.00',
    maxCommission: null,
    priority: 0,
    isActive: true,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CommissionRule;
}

describe('resolveRateFromRules', () => {
  it('global dipakai kalau tidak ada rule lain', () => {
    const rules = [makeRule({ id: 1, scope: 'global', ratePercent: '5.00' })];
    const result = resolveRateFromRules(rules, { tier: 'starter' }, NOW);
    expect(result?.id).toBe(1);
  });

  it('tier menang atas global', () => {
    const rules = [
      makeRule({ id: 1, scope: 'global', ratePercent: '5.00' }),
      makeRule({ id: 2, scope: 'tier', scopeTier: 'pro', ratePercent: '7.00' }),
    ];
    const result = resolveRateFromRules(rules, { tier: 'pro' }, NOW);
    expect(result?.id).toBe(2);
  });

  it('category menang atas tier', () => {
    const rules = [
      makeRule({ id: 1, scope: 'tier', scopeTier: 'pro', ratePercent: '7.00' }),
      makeRule({ id: 2, scope: 'category', categoryId: 10, ratePercent: '2.00' }),
    ];
    const result = resolveRateFromRules(rules, { tier: 'pro', categoryId: 10 }, NOW);
    expect(result?.id).toBe(2);
  });

  it('product menang atas category', () => {
    const rules = [
      makeRule({ id: 1, scope: 'category', categoryId: 10, ratePercent: '2.00' }),
      makeRule({ id: 2, scope: 'product', productId: 99, ratePercent: '12.00' }),
    ];
    const result = resolveRateFromRules(rules, { tier: 'pro', categoryId: 10, productId: 99 }, NOW);
    expect(result?.id).toBe(2);
  });

  it('rule tier untuk tier lain tidak match', () => {
    const rules = [makeRule({ id: 1, scope: 'tier', scopeTier: 'elite', ratePercent: '10.00' })];
    const result = resolveRateFromRules(rules, { tier: 'starter' }, NOW);
    expect(result).toBeNull();
  });

  it('rule tidak aktif diabaikan', () => {
    const rules = [makeRule({ id: 1, scope: 'global', isActive: false })];
    const result = resolveRateFromRules(rules, { tier: 'starter' }, NOW);
    expect(result).toBeNull();
  });

  it('rule di luar periode (belum mulai) diabaikan', () => {
    const rules = [makeRule({ id: 1, scope: 'global', startsAt: new Date('2026-09-01') })];
    const result = resolveRateFromRules(rules, { tier: 'starter' }, NOW);
    expect(result).toBeNull();
  });

  it('rule di luar periode (sudah berakhir) diabaikan', () => {
    const rules = [makeRule({ id: 1, scope: 'global', endsAt: new Date('2026-01-01') })];
    const result = resolveRateFromRules(rules, { tier: 'starter' }, NOW);
    expect(result).toBeNull();
  });

  it('seri di scope sama — priority DESC menang', () => {
    const rules = [
      makeRule({ id: 1, scope: 'global', priority: 1, ratePercent: '5.00' }),
      makeRule({ id: 2, scope: 'global', priority: 5, ratePercent: '8.00' }),
    ];
    const result = resolveRateFromRules(rules, { tier: 'starter' }, NOW);
    expect(result?.id).toBe(2);
  });

  it('tidak ada rule sama sekali -> null', () => {
    const result = resolveRateFromRules([], { tier: 'starter' }, NOW);
    expect(result).toBeNull();
  });
});

describe('calculateCommission', () => {
  it('hitung basic tanpa rule (fallback rate)', () => {
    const result = calculateCommission(100_000, null, 5);
    expect(result).toEqual({ ratePercent: 5, amount: 5_000 });
  });

  it('pakai rate dari rule', () => {
    const rule = makeRule({ ratePercent: '7.50' });
    const result = calculateCommission(100_000, rule, 5);
    expect(result).toEqual({ ratePercent: 7.5, amount: 7_500 });
  });

  it('dibulatkan ke bawah (floor), bukan ke atas', () => {
    // 100_000 * 7.5 / 100 = 7500 tepat, coba angka yang menghasilkan pecahan
    const rule = makeRule({ ratePercent: '5.55' });
    // 100_000 * 5.55 / 100 = 5550 tepat juga, pakai basis ganjil
    const result = calculateCommission(33_333, rule, 5);
    // 33_333 * 5.55 / 100 = 1849.9815 -> floor -> 1849
    expect(result.amount).toBe(1849);
  });

  it('maxCommission membatasi hasil', () => {
    const rule = makeRule({ ratePercent: '10.00', maxCommission: '5000.00' });
    const result = calculateCommission(1_000_000, rule, 5);
    // 1_000_000 * 10% = 100_000, tapi di-cap ke 5_000
    expect(result.amount).toBe(5_000);
  });

  it('maxCommission tidak berlaku kalau hasil di bawah cap', () => {
    const rule = makeRule({ ratePercent: '10.00', maxCommission: '50000.00' });
    const result = calculateCommission(100_000, rule, 5);
    expect(result.amount).toBe(10_000);
  });

  it('ongkir tidak pernah masuk basis — dijamin di sisi pemanggil, bukan di sini', () => {
    // Fungsi ini murni terima baseAmount apa adanya; kontrak "tanpa ongkir" adalah
    // tanggung jawab pemanggil (orderItem.subtotal, bukan order.total).
    const result = calculateCommission(0, null, 5);
    expect(result.amount).toBe(0);
  });
});
