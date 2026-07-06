/**
 * Pure helpers for the staking surface.
 *
 * Extracted from useStakingPageData so the math is unit-testable without
 * a wagmi / React harness. These are intentionally cheap (no allocations,
 * no rounding beyond float precision) — the hook calls them on every poll.
 */

export const SECONDS_PER_YEAR = 86_400 * 365;

/**
 * Back out one geometric growth step from `priceRaw`.
 *
 * The dispatcher's `priceRaw` is the price the NEXT mint will pay; the
 * most-recent ACTUAL minter paid one step less. We assume "every staked
 * NFT was bought at the most recent (highest) mint price" — i.e. the
 * price after the previous mint and before the next one — so we divide
 * out one growth multiplier.
 *
 * highestPrice = priceRaw / (1 + growthBasisPoints / 10_000)
 *              = priceRaw * 10_000 / (10_000 + growthBasisPoints)
 *
 * Returns priceRaw unchanged when growthBasisPoints <= 0 (no growth).
 */
export function backOutGrowthStep(priceRaw: bigint, growthBasisPoints: number): bigint {
  if (growthBasisPoints <= 0) return priceRaw;
  return (priceRaw * 10_000n) / BigInt(10_000 + growthBasisPoints);
}

/**
 * Compute the displayed minimum APY (percentage, e.g. 12.5) from on-chain inputs.
 *
 * Formula (totalStaked > 0):
 *   annualRewardDollars = rewardRate / 1e18 * SECONDS_PER_YEAR * phUsdPrice
 *   highestPriceUsd     = backOutGrowthStep(priceRaw, growth) / 10**priceDecimals
 *   denom               = totalStaked * highestPriceUsd
 *   minApy              = annualRewardDollars / denom * 100
 *
 * `rewardRate` is always denominated in phUSD (18 decimals), so it divides
 * by 1e18 unconditionally. `priceRaw` is denominated in the NFT's payment
 * token, whose scale varies (USDS = 18, USDC = 6), so it divides by
 * 10**priceDecimals — defaulting to 18 to preserve the original USDS path.
 *
 * "minimum" because it assumes the staked subset was bought at the
 * highest historical mint price; earlier (cheaper) mints would yield a
 * higher APY for those holders.
 *
 * Starting APY (totalStaked == 0):
 *   On-chain `rewardRate` is sized against `totalStaked * latestPrice`,
 *   so it is exactly 0 until someone stakes. Substituting totalStaked=1
 *   into the contract's rate formula gives a hypothetical rate of
 *   `latestPrice * targetAPY / (1e18 * SECONDS_PER_YEAR)`; plugging that
 *   back into the APY formula above with denom=`1 * latestPrice` makes
 *   the price cancel, leaving:
 *     startingApy = (targetAPY / 1e18) * phUsdPrice * 100
 *   This is the floor APY a sole first staker would receive.
 */
export function computeMinApy(
  rewardRate: bigint,
  totalStaked: bigint,
  priceRaw: bigint,
  growthBasisPoints: number,
  phUsdPrice: number,
  targetAPY: bigint,
  priceDecimals = 18,
): number {
  const highestPriceRaw = backOutGrowthStep(priceRaw, growthBasisPoints);
  const highestPriceUsd = Number(highestPriceRaw) / 10 ** priceDecimals;

  if (highestPriceUsd <= 0) return 0;

  if (totalStaked === 0n) {
    return (Number(targetAPY) / 1e18) * phUsdPrice * 100;
  }

  const annualRewardDollars =
    (Number(rewardRate) / 1e18) * SECONDS_PER_YEAR * phUsdPrice;

  const denom = Number(totalStaked) * highestPriceUsd;
  if (denom <= 0) return 0;

  return (annualRewardDollars / denom) * 100;
}

/** Inputs for {@link computeApyRange}, all pre-derived by `useStakingPageData`. */
export interface ApyRangeInputs {
  /** Global annual phUSD reward stream in USD (rate × seconds × phUSD/USD). */
  annualRewardDollars: number;
  /**
   * Stake-independent annual emission in USD implied by the funded budget
   * (`totalBudget × 12 / depletionWindowMonths × phUSD/USD`). Used as the
   * depletion empty-pool numerator, since `annualRewardDollars` (derived from
   * the live `currentRewardRate`) reads 0 until the pool has stake. Ignored for
   * fixed stakers. Defaults to 0 when unknown.
   */
  annualBudgetDollars?: number;
  /** Global staked units across all holders. */
  totalStaked: number;
  /** The connected wallet's owned (unstaked) units. */
  ownedUnits: number;
  /** Latest / highest historical mint price in USD — the floor-APY anchor. */
  highestPriceUsd: number;
  /**
   * Pre-computed min APY from {@link computeMinApy}. Used verbatim as the
   * fixed-staker floor (correct for both the live pool and the empty
   * `targetAPY` starting-APY path), so the fixed-staker math is not duplicated.
   */
  minApy: number;
  /**
   * True for fixed stakers (targetAPY auto-scaled rate), false for depletion
   * (fixed-budget) stakers — selects the empty-pool APY path.
   */
  hasTargetApy: boolean;
  /**
   * Earliest / initial mint price in USD — the ceil-APY anchor. Protocol
   * convention pins this at 10 ($10, since USDS ≈ USDC = $1).
   */
  initialPriceUsd?: number;
}

/**
 * Compute a row's `floor → ceil` APY band (percentages, low → high).
 *
 * ⚠️ Direction is counter-intuitive: **earliest mint = cheapest = HIGHEST APY =
 * ceil**; **latest mint = priciest = LOWEST APY = floor**. NFTs are
 * interchangeable and every staked unit earns an equal per-unit reward, so
 * APY = reward ÷ cost-basis: an early (cheap) mint earns more, a late (expensive)
 * mint earns less. `floor` is anchored at the latest/highest price
 * (`highestPriceUsd`); `ceil` at the fixed initial price (`initialPriceUsd`, 10).
 *
 * Fixed stakers (`hasTargetApy`): the reward rate auto-scales to hit `targetAPY`
 * and reads 0 until someone stakes, so the wallet-projection below would be
 * wrong. The floor comes straight from `computeMinApy` (which already handles the
 * empty pool via the `targetAPY` starting-APY, where the mint price cancels — so
 * on an empty pool a sole staker earns `targetAPY` regardless of price, i.e.
 * floor == ceil, no range).
 *
 * Depletion stakers (`!hasTargetApy`): a fixed budget emits over a depletion
 * window, so a **conservative, wallet-based denominator** (mirroring the
 * stable-staker empty-pool precedent, `useStableStakerPools.ts` /
 * `usePhUsdStakePool.ts`) keeps the displayed APY representative instead of
 * spiking:
 *   - pool has stake → real APY off the live total (numerator = live
 *     `annualRewardDollars`, from the running `currentRewardRate`);
 *   - empty, wallet has NFTs → as if all their wallet NFTs were the sole stake;
 *   - empty, no NFTs → as if 1 NFT were staked (at the latest price).
 * This floors expectations so a user's own commit can't make the number collapse.
 *
 * ⚠️ Empty-pool numerator: on an empty depletion pool the live
 * `currentRewardRate` reads **0** (the on-chain rate is `rewardBudget /
 * windowSeconds` and the schedule only re-arms on stake/claim/mint), so
 * `annualRewardDollars` is 0 and would collapse the band to 0–0%. The funded
 * emission (`annualBudgetDollars`, from `totalBudget / depletionWindow`) is the
 * correct stake-independent numerator for that state.
 */
export function computeApyRange({
  annualRewardDollars,
  annualBudgetDollars = 0,
  totalStaked,
  ownedUnits,
  highestPriceUsd,
  minApy,
  hasTargetApy,
  initialPriceUsd = 10,
}: ApyRangeInputs): { floorApy: number; ceilApy: number } {
  const latestPrice = highestPriceUsd > 0 ? highestPriceUsd : initialPriceUsd;

  let floorApy: number;
  let ceilApy: number;

  if (hasTargetApy) {
    // Fixed staker — reuse computeMinApy's result for the floor.
    floorApy = minApy;
    // On a live pool, ceil = floor scaled from the latest price up to the
    // (cheaper) initial price. On an empty pool the sole-staker APY equals
    // targetAPY regardless of mint price, so there is no range.
    ceilApy =
      totalStaked > 0 ? floorApy * (latestPrice / initialPriceUsd) : floorApy;
  } else {
    // Depletion staker — conservative wallet-based denominator. Live pool uses
    // the running emission; empty pool uses the funded-budget emission (the
    // live rate reads 0 until someone stakes — see the JSDoc warning).
    const annualReward =
      totalStaked > 0 ? annualRewardDollars : annualBudgetDollars;
    const effectiveUnits =
      totalStaked > 0 ? totalStaked : ownedUnits > 0 ? ownedUnits : 1;
    floorApy =
      annualReward > 0 && latestPrice > 0
        ? (annualReward / (effectiveUnits * latestPrice)) * 100
        : 0;
    ceilApy =
      annualReward > 0 && initialPriceUsd > 0
        ? (annualReward / (effectiveUnits * initialPriceUsd)) * 100
        : 0;
  }

  // Guard against any residual NaN / Infinity from divide-by-zero.
  if (!Number.isFinite(floorApy)) floorApy = 0;
  if (!Number.isFinite(ceilApy)) ceilApy = 0;

  // Clamp floor ≤ ceil (swap if a sub-initial latest price ever inverts them).
  if (ceilApy < floorApy) {
    const tmp = floorApy;
    floorApy = ceilApy;
    ceilApy = tmp;
  }

  return { floorApy, ceilApy };
}

/**
 * User's share of the global reward stream, in phUSD/sec.
 *
 * Returns 0 when the user has nothing staked or nobody is staking.
 * `userStaked / totalStaked` is computed in float space; for the
 * scales involved (units, not wei) the precision loss is irrelevant
 * and the result feeds a UI counter, not on-chain math.
 */
export function computeUserRatePerSec(
  rewardRate: bigint,
  userStaked: bigint,
  totalStaked: bigint,
): number {
  if (userStaked <= 0n || totalStaked <= 0n) return 0;
  const globalRate = Number(rewardRate) / 1e18;
  const share = Number(userStaked) / Number(totalStaked);
  return globalRate * share;
}
