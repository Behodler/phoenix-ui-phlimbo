import { describe, it, expect } from 'vitest';
import { parseUnits } from 'viem';
import {
  backOutGrowthStep,
  computeMinApy,
  computePhUsdPerSecPerUnit,
  computeUserRatePerSec,
  SECONDS_PER_YEAR,
} from '../stakingMath';

describe('backOutGrowthStep', () => {
  it('returns priceRaw unchanged when growth is 0', () => {
    const price = parseUnits('100', 18);
    expect(backOutGrowthStep(price, 0)).toBe(price);
  });

  it('returns priceRaw unchanged for negative growth (defensive)', () => {
    const price = parseUnits('100', 18);
    expect(backOutGrowthStep(price, -50)).toBe(price);
  });

  it('divides out one growth step exactly when representable', () => {
    // priceRaw = 101, growth = 100bp (1%) → highest = 101 / 1.01 = 100
    const price = parseUnits('101', 18);
    const result = backOutGrowthStep(price, 100);
    expect(result).toBe(parseUnits('100', 18));
  });

  it('strictly decreases priceRaw under positive growth', () => {
    const price = parseUnits('42.5', 18);
    expect(backOutGrowthStep(price, 250)).toBeLessThan(price);
  });
});

describe('computeMinApy', () => {
  it('returns 0 when rewardRate is 0 and supply is staked', () => {
    const apy = computeMinApy(0n, 10n, parseUnits('100', 18), 0, 1, 0n);
    expect(apy).toBe(0);
  });

  it('returns 0 when priceRaw is 0', () => {
    const apy = computeMinApy(parseUnits('1', 18), 10n, 0n, 0, 1, 0n);
    expect(apy).toBe(0);
  });

  it('returns the starting APY (targetAPY * phUsdPrice) when nothing is staked', () => {
    // targetAPY = 0.10e18 → 10%; phUsdPrice = 1 → starting APY = 10%
    const targetAPY = parseUnits('0.10', 18);
    const apy = computeMinApy(0n, 0n, parseUnits('100', 18), 0, 1, targetAPY);
    expect(apy).toBeCloseTo(10, 6);
  });

  it("starting APY does not depend on price when nothing is staked", () => {
    const targetAPY = parseUnits('0.125', 18);
    const a = computeMinApy(0n, 0n, parseUnits('100', 18), 0, 1, targetAPY);
    const b = computeMinApy(0n, 0n, parseUnits('5000', 18), 250, 1, targetAPY);
    expect(a).toBeCloseTo(b, 6);
  });

  it('starting APY scales linearly with phUsdPrice', () => {
    const targetAPY = parseUnits('0.10', 18);
    const at1 = computeMinApy(0n, 0n, parseUnits('100', 18), 0, 1, targetAPY);
    const at2 = computeMinApy(0n, 0n, parseUnits('100', 18), 0, 2, targetAPY);
    expect(at2).toBeCloseTo(at1 * 2, 6);
  });

  it('matches the spec example: rewardRate=1e18/yr, totalStaked=1, priceRaw=100e18, growth=0 → 1%', () => {
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const apy = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 1, 0n);
    expect(apy).toBeCloseTo(1.0, 4);
  });

  it('halves with double the staked supply', () => {
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const single = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 1, 0n);
    const dbl = computeMinApy(rewardRate, 2n, parseUnits('100', 18), 0, 1, 0n);
    expect(dbl).toBeCloseTo(single / 2, 4);
  });

  it('scales linearly with phUsdPrice (staked > 0)', () => {
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const at1 = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 1, 0n);
    const at2 = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 2, 0n);
    expect(at2).toBeCloseTo(at1 * 2, 4);
  });

  it('uses highestPrice (one growth step backed out), not priceRaw', () => {
    // priceRaw = 101, growth = 100bp → highest = 100
    // rewardRate = 1e18/yr, staked = 1, phUsdPrice = 1 → APY = 1%
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const apy = computeMinApy(rewardRate, 1n, parseUnits('101', 18), 100, 1, 0n);
    expect(apy).toBeCloseTo(1.0, 4);
  });

  it('produces a positive realistic APY under typical inputs', () => {
    // 1 phUSD/sec at $1, 100 staked at $42.50 highest, growth 0 → ~7.4M% (toy)
    const rewardRate = parseUnits('1', 18);
    const apy = computeMinApy(rewardRate, 100n, parseUnits('42.5', 18), 0, 1, 0n);
    expect(apy).toBeGreaterThan(0);
    expect(Number.isFinite(apy)).toBe(true);
  });
});

describe('computePhUsdPerSecPerUnit', () => {
  it('returns rewardRate / totalStaked / 1e18 when staked > 0', () => {
    // rewardRate = 1e18 wei/sec → 1 phUSD/sec for the entire stream;
    // totalStaked = 4 → per-unit = 0.25 phUSD/sec
    const rate = computePhUsdPerSecPerUnit(
      parseUnits('1', 18),
      4n,
      parseUnits('100', 18),
      0,
      0n,
    );
    expect(rate).toBeCloseTo(0.25, 9);
  });

  it('returns 0 when staked > 0 but rewardRate is 0', () => {
    const rate = computePhUsdPerSecPerUnit(0n, 5n, parseUnits('100', 18), 0, parseUnits('0.1', 18));
    expect(rate).toBe(0);
  });

  it('returns hypothetical rate at staked=1 when nothing is staked', () => {
    // highestPrice = 100, targetAPY = 0.10 → annual phUSD per unit = 10
    // per-sec = 10 / SECONDS_PER_YEAR
    const rate = computePhUsdPerSecPerUnit(
      0n,
      0n,
      parseUnits('100', 18),
      0,
      parseUnits('0.10', 18),
    );
    expect(rate).toBeCloseTo(10 / SECONDS_PER_YEAR, 6);
  });

  it('returns 0 when staked = 0 and targetAPY = 0', () => {
    const rate = computePhUsdPerSecPerUnit(0n, 0n, parseUnits('100', 18), 0, 0n);
    expect(rate).toBe(0);
  });

  it('returns 0 when staked = 0 and price = 0', () => {
    const rate = computePhUsdPerSecPerUnit(0n, 0n, 0n, 0, parseUnits('0.10', 18));
    expect(rate).toBe(0);
  });

  it('uses highestPrice (one growth step backed out) for the staked=0 fallback', () => {
    // priceRaw = 101, growth = 100bp → highestPrice = 100
    const a = computePhUsdPerSecPerUnit(0n, 0n, parseUnits('101', 18), 100, parseUnits('0.10', 18));
    const b = computePhUsdPerSecPerUnit(0n, 0n, parseUnits('100', 18), 0, parseUnits('0.10', 18));
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('computeUserRatePerSec', () => {
  it('returns 0 when user has nothing staked', () => {
    const rate = computeUserRatePerSec(parseUnits('1', 18), 0n, 100n);
    expect(rate).toBe(0);
  });

  it('returns 0 when nobody is staking', () => {
    const rate = computeUserRatePerSec(parseUnits('1', 18), 5n, 0n);
    expect(rate).toBe(0);
  });

  it('returns full rate when user is the only staker', () => {
    const rate = computeUserRatePerSec(parseUnits('1', 18), 5n, 5n);
    expect(rate).toBeCloseTo(1, 9);
  });

  it('apportions by stake share', () => {
    const rate = computeUserRatePerSec(parseUnits('1', 18), 25n, 100n);
    expect(rate).toBeCloseTo(0.25, 9);
  });
});
