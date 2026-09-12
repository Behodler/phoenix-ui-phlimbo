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

/**
 * phUSD spot price at or below which annihilation returns less value than it
 * destroys, i.e. the point where `2p - 1` stops being positive.
 *
 * Duplicated deliberately from `useStableStakerPools.ts`'s
 * `ANNIHILATE_PRICE_FLOOR`: this module is the pure-math layer and must not
 * import a hook. The two must stay in step — the displayed APY turns negative
 * at exactly the price the annihilate action is disabled at, so a user never
 * sees a negative number beside a live annihilate button.
 */
export const ANNIHILATION_BREAK_EVEN_PRICE = 0.5;

/**
 * Net USD value of annihilating `antimatterAmount` units of Antimatter.
 *
 * Annihilation is NOT a claim. Each unit of Antimatter is destroyed together
 * with one unit of the user's own staked stablecoin, and the pair mints phUSD
 * worth both sides — `2A` phUSD for `A` Antimatter. So with stablecoins at $1
 * and phUSD at `p`:
 *
 * ```
 *   gross value = 2 × A × p     (the phUSD minted, at market)
 *   cost        = A             (the annihilated principal, at $1/unit)
 *   net yield   = 2 × A × p − A = A × (2p − 1)
 * ```
 *
 * Worked examples (the human's own, preserved in the unit tests):
 * `A = 2, p = 0.8` → `2 × (1.6 − 1) = 1.2`; `A = 10, p = 0.9` → `10 × 0.8 = 8`.
 *
 * ⚠️ The sign flips below `p = 0.5` ({@link ANNIHILATION_BREAK_EVEN_PRICE}):
 * the phUSD received is then worth less than the principal destroyed, so the
 * net yield — and any APY derived from it — is genuinely **negative**. That is
 * reported honestly rather than clamped to zero; the annihilate action is
 * separately disabled at `p <= 0.5` so the honest number cannot be acted on.
 *
 * Both arguments are already-descaled human units, so this is plain float math.
 */
export function computeAnnihilationNetYieldUSD(
  antimatterAmount: number,
  phUsdPrice: number,
): number {
  return antimatterAmount * (2 * phUsdPrice - 1);
}

/** Inputs for {@link computeAntimatterApy}. */
export interface AntimatterApyInputs {
  /**
   * Pool-wide Antimatter emission rate, per second, 18 decimals
   * (`poolInfo(token).antimatterPerSecond`). `null` means **not yet known**
   * (the read has not resolved) and yields a `null` APY; `0n` is a real zero
   * emission rate and yields `0`.
   */
  antimatterPerSecond: bigint | null;
  /**
   * `antimatterAbi.toStableAmount(token, antimatterPerSecond × SECONDS_PER_YEAR)`
   * — the annual emission already expressed in the stake token's own decimals,
   * by the contract that owns that conversion.
   *
   * Preferred over the off-chain fallback because it encodes the protocol's
   * definition of "one Antimatter annihilates one unit of stable" instead of
   * reimplementing it. When `undefined`, the amount is derived off-chain from
   * `antimatterPerSecond` instead (both paths agree, since 1 Antimatter matches
   * 1 whole stake token; the units only differ in scale).
   */
  annualAntimatterAsStableRaw?: bigint;
  /** Pool principal, `poolInfo(token).totalStaked`, in `stableDecimals`. */
  totalStaked: bigint;
  /** Native decimals of the stake token (USDC 6, USDe/DOLA 18). */
  stableDecimals: number;
  /**
   * phUSD spot price in USD, already descaled. `null` when unknown — which
   * returns a `null` APY so the UI renders its em dash. Off mainnet the repo's
   * convention substitutes `1.0`, which makes `(2p − 1) = 1` and reduces this
   * to the ordinary `annualEmission / principal` yield.
   */
  phUsdPrice: number | null;
  /**
   * Connected wallet's unstaked balance of the stake token, human units. Only
   * used for the empty-pool denominator.
   */
  walletBalance: number;
}

/**
 * Net-yield APY (percent, e.g. `8` for 8%) for one Antimatter stable pool, or
 * `null` when it is genuinely unknown.
 *
 * ```
 *   APY% = min(A_annual, principal) / principal × (2p − 1) × 100
 * ```
 *
 * where `A_annual` is the pool-wide annual Antimatter emission and `principal`
 * is the pool's staked total — **both in the same stable units**, so the
 * decimals cancel and no `1e12` USDC-vs-USDe error can creep in. See
 * {@link computeAnnihilationNetYieldUSD} for the derivation of the `(2p − 1)`
 * factor; the whole of this calculation is that one factor applied to an
 * ordinary yield ratio. Sanity check: at `p = 1` it reduces to
 * `A_annual / principal`, and the human's example
 * `(10 / 100) × (2 × 0.9 − 1) × 100` gives `8`.
 *
 * ⚠️ **Negative below `p = 0.5`** and deliberately displayed that way — see
 * {@link ANNIHILATION_BREAK_EVEN_PRICE}. Concealing a real loss from someone
 * deciding whether to stake would be worse than showing it; the annihilate
 * action is disabled in that regime.
 *
 * Three conventions, each mirroring one already in the repo:
 *
 * - **Unknown is `null`, never `0`.** An unresolved price or emission read
 *   renders as an em dash. A `0` would read as a real zero yield.
 * - **Empty pool** (`totalStaked == 0`) borrows the denominator
 *   `useStableStakerPools` / `usePhUsdStakePool` already use: the user's own
 *   wallet balance, or 100 when that is negligible. The denominator therefore
 *   assumes the user's own stake dilutes the pool, so their deposit cannot make
 *   the displayed number collapse — the conservative direction.
 * - **The emission is clamped to the principal.** Antimatter beyond the staked
 *   total has nothing to annihilate against (on-chain, the `excessMinted` leg
 *   of `AutoAnnihilated`, whose realisable value is not the clean `2p − 1`), so
 *   it is valued at zero. That floors the APY rather than inflating it —
 *   rounding in favour of the protocol. In the normal regime, where emissions
 *   are a small fraction of principal, the clamp never binds.
 */
export function computeAntimatterApy({
  antimatterPerSecond,
  annualAntimatterAsStableRaw,
  totalStaked,
  stableDecimals,
  phUsdPrice,
  walletBalance,
}: AntimatterApyInputs): number | null {
  if (phUsdPrice === null) return null;
  if (antimatterPerSecond === null && annualAntimatterAsStableRaw === undefined) return null;

  // Annual emission in whole stake-token units. The contract's own conversion
  // wins when present; otherwise descale the 18-dec Antimatter rate directly,
  // since one whole Antimatter matches one whole stake token.
  const annualEmission =
    annualAntimatterAsStableRaw !== undefined
      ? Number(annualAntimatterAsStableRaw) / 10 ** stableDecimals
      : (Number(antimatterPerSecond ?? 0n) / 1e18) * SECONDS_PER_YEAR;

  const principal =
    totalStaked > 0n
      ? Number(totalStaked) / 10 ** stableDecimals
      : walletBalance < 10
        ? 100
        : walletBalance;

  if (!(principal > 0)) return null;

  // Excess emissions cannot be annihilated against principal that is not there.
  const matched = Math.min(annualEmission, principal);

  const apy = (matched / principal) * (2 * phUsdPrice - 1) * 100;

  return Number.isFinite(apy) ? apy : null;
}
