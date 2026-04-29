import { describe, it, expect } from 'vitest';
import { parseUnits } from 'viem';
import {
  backOutGrowthStep,
  computeMinApy,
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
  it('returns 0 when rewardRate is 0', () => {
    const apy = computeMinApy(0n, 10n, parseUnits('100', 18), 0, 1);
    expect(apy).toBe(0);
  });

  it('returns 0 when priceRaw is 0', () => {
    const apy = computeMinApy(parseUnits('1', 18), 10n, 0n, 0, 1);
    expect(apy).toBe(0);
  });

  it('clamps totalStaked = 0 to a denominator of 1 (first-staker ceiling)', () => {
    // rewardRate = 1e18 / SECONDS_PER_YEAR phUSD/sec → annual stream = $1
    // priceRaw = 100e18, growth = 0 → highest = 100
    // staked = 0 → denom = 1 * 100 = 100, APY = 1/100 * 100 = 1.0%
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const apy = computeMinApy(rewardRate, 0n, parseUnits('100', 18), 0, 1);
    expect(apy).toBeCloseTo(1.0, 4);
  });

  it('matches the spec example: rewardRate=1e18/yr, totalStaked=1, priceRaw=100e18, growth=0 → 1%', () => {
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const apy = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 1);
    expect(apy).toBeCloseTo(1.0, 4);
  });

  it('halves with double the staked supply', () => {
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const single = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 1);
    const dbl = computeMinApy(rewardRate, 2n, parseUnits('100', 18), 0, 1);
    expect(dbl).toBeCloseTo(single / 2, 4);
  });

  it('scales linearly with phUsdPrice', () => {
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const at1 = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 1);
    const at2 = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 2);
    expect(at2).toBeCloseTo(at1 * 2, 4);
  });

  it('uses highestPrice (one growth step backed out), not priceRaw', () => {
    // priceRaw = 101, growth = 100bp → highest = 100
    // rewardRate = 1e18/yr, staked = 1, phUsdPrice = 1 → APY = 1%
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const apy = computeMinApy(rewardRate, 1n, parseUnits('101', 18), 100, 1);
    expect(apy).toBeCloseTo(1.0, 4);
  });

  it('produces a positive realistic APY under typical inputs', () => {
    // 1 phUSD/sec at $1, 100 staked at $42.50 highest, growth 0 → ~7.4M% (toy)
    const rewardRate = parseUnits('1', 18);
    const apy = computeMinApy(rewardRate, 100n, parseUnits('42.5', 18), 0, 1);
    expect(apy).toBeGreaterThan(0);
    expect(Number.isFinite(apy)).toBe(true);
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
