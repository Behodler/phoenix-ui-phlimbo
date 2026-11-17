import { describe, it, expect } from 'vitest';
import { computeDiscountDisplay, type DiscountDisplayInput } from './discountBatchMath';
import { geometricSumRaw } from './batchMintMath';

const PRICE = 10n * 10n ** 18n;
const GROWTH = 10;

function input(overrides: Partial<DiscountDisplayInput> = {}): DiscountDisplayInput {
  return {
    free: 12,
    total: 24,
    paidCostRaw: geometricSumRaw(PRICE, GROWTH, 12),
    discountPercent: 50,
    priceRaw: PRICE,
    growthBps: GROWTH,
    ...overrides,
  };
}

describe('computeDiscountDisplay', () => {
  it('usual = ramp over total; saving = usual - live paidCost; avg = paidCost / total', () => {
    const d = computeDiscountDisplay(input());
    expect(d.usualCostRaw).toBe(geometricSumRaw(PRICE, GROWTH, 24));
    expect(d.savingRaw).toBe(d.usualCostRaw - geometricSumRaw(PRICE, GROWTH, 12));
    expect(d.avgPricePaidRaw).toBe(geometricSumRaw(PRICE, GROWTH, 12) / 24n);
  });

  it('uses the live paidCost verbatim rather than recomputing it', () => {
    const d = computeDiscountDisplay(input({ paidCostRaw: 1_000n }));
    expect(d.savingRaw).toBe(geometricSumRaw(PRICE, GROWTH, 24) - 1_000n);
    expect(d.avgPricePaidRaw).toBe(1_000n / 24n);
  });

  it('saving floors at 0 if a stale price makes usual < paidCost', () => {
    const d = computeDiscountDisplay(input({ paidCostRaw: 10n ** 30n }));
    expect(d.savingRaw).toBe(0n);
  });

  it('effective saving is a little above the headline % with a rising price', () => {
    const d = computeDiscountDisplay(input());
    expect((d.savingRaw * 10_000n) / d.usualCostRaw).toBeGreaterThan(5_000n);
  });

  it('unboosted comparison: 50 free at base 50% → 50 paid, even when the live batch is boosted', () => {
    // Live boosted batch: 50 free at 60% → total 84, paid 34.
    const d = computeDiscountDisplay(
      input({ free: 50, total: 84, paidCostRaw: geometricSumRaw(PRICE, GROWTH, 34) })
    );
    expect(d.unboostedPaid).toBe(50);
    expect(d.unboostedPaidCostRaw).toBe(geometricSumRaw(PRICE, GROWTH, 50));
    expect(d.unboostedPaidCostRaw).toBeGreaterThan(geometricSumRaw(PRICE, GROWTH, 34));
  });

  it('unboosted comparison ceil-divides (7 free at 60% → 12 total, 5 paid)', () => {
    const d = computeDiscountDisplay(input({ free: 7, total: 12, discountPercent: 60 }));
    expect(d.unboostedPaid).toBe(5);
  });

  it('total 0 / free 0 → all zeros', () => {
    for (const o of [{ total: 0 }, { free: 0 }]) {
      const d = computeDiscountDisplay(input(o));
      expect(d.usualCostRaw).toBe(0n);
      expect(d.savingRaw).toBe(0n);
      expect(d.avgPricePaidRaw).toBe(0n);
      expect(d.unboostedPaid).toBe(0);
    }
  });
});
