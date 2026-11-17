import { describe, it, expect } from 'vitest';
import { computeDiscountBatch, type DiscountBatchInput } from './discountBatchMath';
import { geometricSumRaw } from './batchMintMath';

const PRICE = 10n * 10n ** 18n;
const GROWTH = 10;

function input(overrides: Partial<DiscountBatchInput> = {}): DiscountBatchInput {
  return {
    potFree: 12,
    discountPercent: 50,
    cap: 50,
    perPoint: 3,
    maxBoost: 10,
    priceRaw: PRICE,
    growthBps: GROWTH,
    ...overrides,
  };
}

describe('computeDiscountBatch', () => {
  it('normal state: potFree 12 at 50% → 12 free, 24 total, 12 paid, no boost', () => {
    const b = computeDiscountBatch(input());
    expect(b.free).toBe(12);
    expect(b.total).toBe(24);
    expect(b.paid).toBe(12);
    expect(b.boost).toBe(0);
    expect(b.overflow).toBe(0);
    expect(b.effectivePercent).toBe(50);
    expect(b.unboostedTotal).toBe(24);
    expect(b.unboostedPaid).toBe(12);
  });

  it('cap reached + boost: potFree 80 → boost 10, 60%, 84 total, 34 paid; unboosted 100/50', () => {
    const b = computeDiscountBatch(input({ potFree: 80 }));
    expect(b.free).toBe(50);
    expect(b.overflow).toBe(30);
    expect(b.boost).toBe(10);
    expect(b.effectivePercent).toBe(60);
    expect(b.total).toBe(84);
    expect(b.paid).toBe(34);
    expect(b.unboostedTotal).toBe(100);
    expect(b.unboostedPaid).toBe(50);
    expect(b.unboostedPaidCostRaw).toBe(geometricSumRaw(PRICE, GROWTH, 50));
    expect(b.unboostedPaidCostRaw).toBeGreaterThan(b.paidCostRaw);
  });

  it('maxBoost 0 → no boost at the cap', () => {
    const b = computeDiscountBatch(input({ potFree: 80, maxBoost: 0 }));
    expect(b.boost).toBe(0);
    expect(b.effectivePercent).toBe(50);
    expect(b.total).toBe(100);
    expect(b.paid).toBe(50);
  });

  it('potFree 49 with perPoint 3 → overflow 0, no boost', () => {
    const b = computeDiscountBatch(input({ potFree: 49 }));
    expect(b.overflow).toBe(0);
    expect(b.boost).toBe(0);
    expect(b.free).toBe(49);
    expect(b.total).toBe(98);
    expect(b.paid).toBe(49);
  });

  it('overflow below one boost point floors to 0', () => {
    const b = computeDiscountBatch(input({ potFree: 52 }));
    expect(b.overflow).toBe(2);
    expect(b.boost).toBe(0);
  });

  it('discount 0 → all zeros', () => {
    const b = computeDiscountBatch(input({ discountPercent: 0 }));
    expect(b.total).toBe(0);
    expect(b.paid).toBe(0);
    expect(b.free).toBe(0);
    expect(b.paidCostRaw).toBe(0n);
    expect(b.usualCostRaw).toBe(0n);
    expect(b.avgPricePaidRaw).toBe(0n);
  });

  it('potFree 0 → all zeros', () => {
    const b = computeDiscountBatch(input({ potFree: 0 }));
    expect(b.total).toBe(0);
    expect(b.paid).toBe(0);
    expect(b.savingRaw).toBe(0n);
  });

  it('effective discount clamps at 99, so paid stays ≥ 1', () => {
    const b = computeDiscountBatch(
      input({ discountPercent: 95, potFree: 50 + 3 * 49, maxBoost: 49 })
    );
    expect(b.boost).toBe(49);
    expect(b.effectivePercent).toBe(99);
    // ceil(50 * 100 / 99) = 51
    expect(b.total).toBe(51);
    expect(b.paid).toBe(1);
  });

  it('ceil-divides the total (non-integer ratio)', () => {
    // 7 free at 60% → ceil(700/60) = 12, paid 5
    const b = computeDiscountBatch(input({ potFree: 7, discountPercent: 60 }));
    expect(b.total).toBe(12);
    expect(b.paid).toBe(5);
  });

  it('costs: paid = ramp over paid, usual = ramp over total, saving = difference', () => {
    const b = computeDiscountBatch(input());
    expect(b.paidCostRaw).toBe(geometricSumRaw(PRICE, GROWTH, 12));
    expect(b.usualCostRaw).toBe(geometricSumRaw(PRICE, GROWTH, 24));
    expect(b.usualCostRaw).toBeGreaterThan(b.paidCostRaw);
    expect(b.savingRaw).toBe(b.usualCostRaw - b.paidCostRaw);
    expect(b.avgPricePaidRaw).toBe(b.paidCostRaw / 24n);
  });

  it('effective saving is a little above the headline % with a rising price', () => {
    const b = computeDiscountBatch(input());
    const savingBps = (b.savingRaw * 10_000n) / b.usualCostRaw;
    expect(savingBps).toBeGreaterThan(5_000n);
  });
});
