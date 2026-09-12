import { describe, it, expect } from 'vitest';
import { parseUnits } from 'viem';
import {
  backOutGrowthStep,
  computeMinApy,
  computeUserRatePerSec,
  computeAnnihilationNetYieldUSD,
  computeAntimatterApy,
  ANNIHILATION_BREAK_EVEN_PRICE,
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

describe('computeAnnihilationNetYieldUSD', () => {
  // The human's own worked examples, reproduced verbatim.
  it("matches the human's first example: A = 2, p = 0.8 -> net 1.2", () => {
    // gross = 2 x 2 x 0.8 = 3.2, cost = 2, net = 1.2
    expect(computeAnnihilationNetYieldUSD(2, 0.8)).toBeCloseTo(1.2, 12);
  });

  it("matches the human's second example: A = 10, p = 0.9 -> net 8", () => {
    // gross = 2 x 10 x 0.9 = 18, cost = 10, net = 8
    expect(computeAnnihilationNetYieldUSD(10, 0.9)).toBeCloseTo(8, 12);
  });

  it('is exactly zero at the break-even price', () => {
    expect(computeAnnihilationNetYieldUSD(10, ANNIHILATION_BREAK_EVEN_PRICE)).toBe(0);
  });

  it('goes negative below the break-even price', () => {
    // p = 0.25 -> 2p - 1 = -0.5, so 10 Antimatter destroys $5 of value
    expect(computeAnnihilationNetYieldUSD(10, 0.25)).toBeCloseTo(-5, 12);
  });

  it('reduces to the plain amount at p = 1', () => {
    expect(computeAnnihilationNetYieldUSD(7, 1)).toBeCloseTo(7, 12);
  });
});

describe('computeAntimatterApy', () => {
  /** 10 Antimatter/year as an 18-dec per-second rate. */
  const ratePerSecFor = (annualWhole: number) =>
    parseUnits(String(annualWhole), 18) / BigInt(SECONDS_PER_YEAR);

  const base = {
    stableDecimals: 6,
    walletBalance: 0,
  };

  it("matches the human's second example as an APY: A_annual = 10, principal = 100, p = 0.9 -> 8%", () => {
    const apy = computeAntimatterApy({
      ...base,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
      totalStaked: parseUnits('100', 6),
      phUsdPrice: 0.9,
    });
    expect(apy).toBeCloseTo(8, 9);
  });

  it('reduces to the plain A_annual / totalStaked yield at p = 1', () => {
    const apy = computeAntimatterApy({
      ...base,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
      totalStaked: parseUnits('100', 6),
      phUsdPrice: 1,
    });
    // (10 / 100) x 1 x 100 = 10%
    expect(apy).toBeCloseTo(10, 9);
  });

  it('produces a negative APY below the break-even price', () => {
    const apy = computeAntimatterApy({
      ...base,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
      totalStaked: parseUnits('100', 6),
      phUsdPrice: 0.25,
    });
    // (10 / 100) x (0.5 - 1) x 100 = -5%
    expect(apy).toBeCloseTo(-5, 9);
    expect(apy!).toBeLessThan(0);
  });

  it('is exactly zero at the break-even price, matching the annihilate gate', () => {
    const apy = computeAntimatterApy({
      ...base,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
      totalStaked: parseUnits('100', 6),
      phUsdPrice: ANNIHILATION_BREAK_EVEN_PRICE,
    });
    expect(apy).toBe(0);
  });

  it('clamps the annihilated amount to the principal when emissions exceed it', () => {
    const apy = computeAntimatterApy({
      ...base,
      antimatterPerSecond: null,
      // 400 Antimatter/yr against 100 staked: only 100 can be matched.
      annualAntimatterAsStableRaw: parseUnits('400', 6),
      totalStaked: parseUnits('100', 6),
      phUsdPrice: 0.9,
    });
    // matched/principal is clamped to 1, so APY = (2p - 1) x 100 = 80%,
    // not the unclamped 320%.
    expect(apy).toBeCloseTo(80, 9);
  });

  it('gives identical APYs for equal USD stakes across 6-dec USDC and 18-dec USDe', () => {
    const usdc = computeAntimatterApy({
      stableDecimals: 6,
      walletBalance: 0,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
      totalStaked: parseUnits('100', 6),
      phUsdPrice: 0.9,
    });
    const usde = computeAntimatterApy({
      stableDecimals: 18,
      walletBalance: 0,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 18),
      totalStaked: parseUnits('100', 18),
      phUsdPrice: 0.9,
    });
    expect(usdc).toBeCloseTo(8, 9);
    expect(usde).toBeCloseTo(usdc!, 9);
  });

  it('agrees with the on-chain conversion when falling back to off-chain scaling', () => {
    const shared = {
      stableDecimals: 6 as const,
      walletBalance: 0,
      totalStaked: parseUnits('100', 6),
      phUsdPrice: 0.9,
    };
    const onChain = computeAntimatterApy({
      ...shared,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
    });
    const offChain = computeAntimatterApy({
      ...shared,
      antimatterPerSecond: ratePerSecFor(10),
    });
    // Integer division of the per-second rate loses a little precision, hence
    // the looser tolerance; the 1e12 decimal error this test guards against
    // would be catastrophic rather than marginal.
    expect(offChain).toBeCloseTo(onChain!, 4);
  });

  it('returns null (never 0) when the phUSD price is unknown', () => {
    expect(
      computeAntimatterApy({
        ...base,
        antimatterPerSecond: null,
        annualAntimatterAsStableRaw: parseUnits('10', 6),
        totalStaked: parseUnits('100', 6),
        phUsdPrice: null,
      }),
    ).toBeNull();
  });

  it('returns null (never 0) when the emission rate has not resolved', () => {
    expect(
      computeAntimatterApy({
        ...base,
        antimatterPerSecond: null,
        totalStaked: parseUnits('100', 6),
        phUsdPrice: 0.9,
      }),
    ).toBeNull();
  });

  it('returns 0 for a genuinely zero emission rate', () => {
    expect(
      computeAntimatterApy({
        ...base,
        antimatterPerSecond: 0n,
        totalStaked: parseUnits('100', 6),
        phUsdPrice: 0.9,
      }),
    ).toBe(0);
  });

  it('uses the wallet balance as the empty-pool denominator', () => {
    const apy = computeAntimatterApy({
      stableDecimals: 6,
      walletBalance: 1_000,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
      totalStaked: 0n,
      phUsdPrice: 0.9,
    });
    // (10 / 1000) x 0.8 x 100 = 0.8%
    expect(apy).toBeCloseTo(0.8, 9);
  });

  it('falls back to a 100-unit empty-pool denominator for a negligible wallet', () => {
    const apy = computeAntimatterApy({
      stableDecimals: 6,
      walletBalance: 3,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
      totalStaked: 0n,
      phUsdPrice: 0.9,
    });
    expect(apy).toBeCloseTo(8, 9);
  });

  it('never reports a higher APY because the user has not staked yet', () => {
    const emptyPool = computeAntimatterApy({
      stableDecimals: 6,
      walletBalance: 1_000,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
      totalStaked: 0n,
      phUsdPrice: 0.9,
    })!;
    const afterStaking = computeAntimatterApy({
      stableDecimals: 6,
      walletBalance: 0,
      antimatterPerSecond: null,
      annualAntimatterAsStableRaw: parseUnits('10', 6),
      totalStaked: parseUnits('1000', 6),
      phUsdPrice: 0.9,
    })!;
    expect(emptyPool).toBeCloseTo(afterStaking, 9);
  });
});
