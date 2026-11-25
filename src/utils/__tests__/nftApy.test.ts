import { describe, it, expect } from 'vitest';
import {
  computePerUnitAnnualRewardUsd,
  computeUserNftApy,
  selectCostBasisAvgUsd,
} from '../stakingMath';
import {
  buildStableTokenDecimals,
  groupPricesByIndex,
  type RawMintEntry,
} from '../nftMintPrices';

const USDC = '0x00000000000000000000000000000000000000c6';
const USDS = '0x00000000000000000000000000000000000000d5';
const EYE = '0x00000000000000000000000000000000000000e1';
const stables = buildStableTokenDecimals({ USDC, USDS });

/**
 * The floor of the removed `computeApyRange`, reproduced verbatim (minus the
 * floor/ceil swap, which only binds below the $10 initial price) so the per-unit
 * reward can be pinned against what the range used to show at the latest price.
 */
function legacyFloorApy(p: {
  annualRewardDollars: number;
  annualBudgetDollars: number;
  totalStaked: number;
  ownedUnits: number;
  highestPriceUsd: number;
  minApy: number;
  hasTargetApy: boolean;
}): number {
  const latestPrice = p.highestPriceUsd > 0 ? p.highestPriceUsd : 10;
  if (p.hasTargetApy) return p.minApy;
  const annualReward = p.totalStaked > 0 ? p.annualRewardDollars : p.annualBudgetDollars;
  const effectiveUnits = p.totalStaked > 0 ? p.totalStaked : p.ownedUnits > 0 ? p.ownedUnits : 1;
  return annualReward > 0 ? (annualReward / (effectiveUnits * latestPrice)) * 100 : 0;
}

describe('selectCostBasisAvgUsd', () => {
  it('rule 1: no holdings → marginal price', () => {
    expect(selectCostBasisAvgUsd([12, 11], 0, 30)).toBe(30);
    expect(selectCostBasisAvgUsd([], 0, 25)).toBe(25);
  });

  it('rule 2: held < minted → keeps the most expensive k', () => {
    // Minted at 10, 12, 20; holds 2 → assume 20 and 12 kept.
    expect(selectCostBasisAvgUsd([10, 20, 12], 2, 50)).toBe(16);
  });

  it('rule 3: held > minted → surplus counted at marginal', () => {
    // Minted 1 at 10, holds 3, marginal 25 → (10 + 25 + 25) / 3.
    expect(selectCostBasisAvgUsd([10], 3, 25)).toBe(20);
  });

  it('held == minted → plain mean of paid prices', () => {
    expect(selectCostBasisAvgUsd([10, 14], 2, 99)).toBe(12);
  });

  it('free mints (no ClaimMinted price) fall to marginal', () => {
    // ClaimMintedFor carries no price, so a free unit is simply absent from
    // the paid list; holding it is the same as a surplus unit.
    expect(selectCostBasisAvgUsd([], 1, 18)).toBe(18);
  });

  it('ignores non-finite / non-positive paid prices', () => {
    expect(selectCostBasisAvgUsd([NaN, -1, 0, Infinity, 10], 2, 30)).toBe(20);
  });
});

describe('computeUserNftApy', () => {
  it('per-unit reward ÷ avg price × 100', () => {
    expect(computeUserNftApy(2, 20)).toBeCloseTo(10, 12);
  });

  it('non-finite or ≤ 0 → null (never 0)', () => {
    expect(computeUserNftApy(0, 20)).toBeNull();
    expect(computeUserNftApy(2, 0)).toBeNull();
    expect(computeUserNftApy(2, NaN)).toBeNull();
    expect(computeUserNftApy(NaN, 10)).toBeNull();
    expect(computeUserNftApy(Infinity, 10)).toBeNull();
    expect(computeUserNftApy(-1, 10)).toBeNull();
  });

  it('a cheaper cost basis gives a higher APY than the latest price', () => {
    const perUnit = 3;
    const atLatest = computeUserNftApy(perUnit, 30)!;
    const early = computeUserNftApy(perUnit, selectCostBasisAvgUsd([10, 11], 2, 31))!;
    expect(early).toBeGreaterThan(atLatest);
  });
});

describe('computePerUnitAnnualRewardUsd — regression vs the old floor', () => {
  const cases = [
    {
      name: 'fixed, live pool',
      p: { annualRewardDollars: 500, annualBudgetDollars: 0, totalStaked: 40, ownedUnits: 2, highestPriceUsd: 27.5, minApy: 45.45, hasTargetApy: true },
    },
    {
      name: 'fixed, empty pool (targetAPY starting APY)',
      p: { annualRewardDollars: 0, annualBudgetDollars: 0, totalStaked: 0, ownedUnits: 0, highestPriceUsd: 12, minApy: 30, hasTargetApy: true },
    },
    {
      name: 'depletion, live pool',
      p: { annualRewardDollars: 1_200, annualBudgetDollars: 9_999, totalStaked: 8, ownedUnits: 3, highestPriceUsd: 15, minApy: 0, hasTargetApy: false },
    },
    {
      name: 'depletion, empty pool, wallet holds NFTs',
      p: { annualRewardDollars: 0, annualBudgetDollars: 600, totalStaked: 0, ownedUnits: 4, highestPriceUsd: 12.5, minApy: 0, hasTargetApy: false },
    },
    {
      name: 'depletion, empty pool, wallet holds nothing (1 NFT)',
      p: { annualRewardDollars: 0, annualBudgetDollars: 600, totalStaked: 0, ownedUnits: 0, highestPriceUsd: 12.5, minApy: 0, hasTargetApy: false },
    },
  ];

  for (const { name, p } of cases) {
    it(`${name}: APY at the latest price equals the old floor`, () => {
      const perUnit = computePerUnitAnnualRewardUsd(p);
      expect(computeUserNftApy(perUnit, p.highestPriceUsd)).toBeCloseTo(legacyFloorApy(p), 9);
    });
  }

  it('falls back to the $10 initial price when the latest price is unknown', () => {
    expect(
      computePerUnitAnnualRewardUsd({
        annualRewardDollars: 0, totalStaked: 0, ownedUnits: 0,
        highestPriceUsd: 0, minApy: 20, hasTargetApy: true,
      }),
    ).toBeCloseTo(2, 12);
  });

  it('returns 0 for an unfunded depletion staker', () => {
    expect(
      computePerUnitAnnualRewardUsd({
        annualRewardDollars: 0, annualBudgetDollars: 0, totalStaked: 0, ownedUnits: 0,
        highestPriceUsd: 12, minApy: 0, hasTargetApy: false,
      }),
    ).toBe(0);
  });
});

describe('cost basis from raw ClaimMinted entries', () => {
  it('drops unknown tokens and mixes 6 dp / 18 dp stables', () => {
    const entries: RawMintEntry[] = [
      { index: 4, token: USDC, pricePaid: '10000000' }, // $10 USDC
      { index: 4, token: USDS, pricePaid: '12000000000000000000' }, // $12 USDS
      { index: 4, token: EYE, pricePaid: '999000000000000000000' }, // pre-075 EYE → dropped
    ];
    const paid = groupPricesByIndex(entries, stables).get(4)!;
    expect(paid.sort()).toEqual([10, 12]);
    // Holds 3: two priced mints + the EYE-paid unit at marginal 20.
    const avg = selectCostBasisAvgUsd(paid, 3, 20);
    expect(avg).toBeCloseTo(14, 12);
    expect(computeUserNftApy(2.8, avg)).toBeCloseTo(20, 9);
  });
});
