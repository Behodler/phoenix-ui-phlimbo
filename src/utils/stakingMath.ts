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
 *   highestPriceUsd     = backOutGrowthStep(priceRaw, growth) / 1e18  (USDS pinned to $1)
 *   denom               = totalStaked * highestPriceUsd
 *   minApy              = annualRewardDollars / denom * 100
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
): number {
  const highestPriceRaw = backOutGrowthStep(priceRaw, growthBasisPoints);
  const highestPriceUsd = Number(highestPriceRaw) / 1e18;

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
