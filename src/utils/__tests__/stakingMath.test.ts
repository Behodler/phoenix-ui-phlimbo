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

  it('defaults priceDecimals to 18 when the arg is omitted', () => {
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const omitted = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 1, 0n);
    const explicit = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 1, 0n, 18);
    expect(omitted).toBeCloseTo(explicit, 9);
  });

  it('is decimal-invariant: a 6-decimal (USDC) price yields the same APY as the equivalent 18-decimal (USDS) price', () => {
    // Same $100 NFT price, expressed in USDS (18 dp) vs USDC (6 dp).
    const rewardRate = parseUnits('1', 18) / BigInt(SECONDS_PER_YEAR);
    const usds = computeMinApy(rewardRate, 1n, parseUnits('100', 18), 0, 1, 0n, 18);
    const usdc = computeMinApy(rewardRate, 1n, parseUnits('100', 6), 0, 1, 0n, 6);
    expect(usdc).toBeCloseTo(usds, 4);
    // ... and a USDC price read with the wrong (18) scale wildly inflates APY,
    // which is exactly the bug priceDecimals fixes.
    const usdcMisread = computeMinApy(rewardRate, 1n, parseUnits('100', 6), 0, 1, 0n, 18);
    expect(usdcMisread).toBeGreaterThan(usdc * 1e6);
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
