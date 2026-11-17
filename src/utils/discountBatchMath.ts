/**
 * Display maths for the discount batch mint (nft-staking
 * `BatchNFTMinterNudgeDiscount._computeBatch`), used by the Whale-mock preview.
 *
 * Mirrors the contract's integer maths exactly:
 *   free      = min(potFree, cap)
 *   overflow  = potFree > cap ? potFree - cap : 0
 *   boost     = min(maxBoost, floor(overflow / perPoint))
 *   effective = min(discountPercent + boost, 99)
 *   total     = ceil(free * 100 / effective);  paid = total - free  (>= 1)
 *
 * Free NFTs are minted without moving the price, so the user's cost is the
 * rising-price sum over `paid` NFTs only. The "usual" cost is the same ramp
 * over all `total` NFTs: what that quantity costs through the normal mint.
 */
import { geometricSumRaw } from './batchMintMath';

export interface DiscountBatchInput {
  /** Free-NFT equivalents the discount fund covers (uncapped). */
  potFree: number;
  /** Base discount: 0 (off) or 50..99. */
  discountPercent: number;
  /** `maxFreePerBatch`. */
  cap: number;
  /** `overflowNFTsPerBoostPoint`. */
  perPoint: number;
  maxBoost: number;
  /** Current per-NFT price (raw). */
  priceRaw: bigint;
  /** Per-mint growth in basis points. */
  growthBps: number;
}

export interface DiscountBatch {
  free: number;
  total: number;
  paid: number;
  boost: number;
  effectivePercent: number;
  overflow: number;
  /** What the user pays: the price ramp over `paid` NFTs. */
  paidCostRaw: bigint;
  /** What `total` NFTs cost through the normal mint. */
  usualCostRaw: bigint;
  savingRaw: bigint;
  /** `paidCostRaw / total`. */
  avgPricePaidRaw: bigint;
  /** The same batch with boost = 0. */
  unboostedTotal: number;
  unboostedPaid: number;
  /** Price ramp over `unboostedPaid` NFTs. */
  unboostedPaidCostRaw: bigint;
}

const ZERO: DiscountBatch = {
  free: 0,
  total: 0,
  paid: 0,
  boost: 0,
  effectivePercent: 0,
  overflow: 0,
  paidCostRaw: 0n,
  usualCostRaw: 0n,
  savingRaw: 0n,
  avgPricePaidRaw: 0n,
  unboostedTotal: 0,
  unboostedPaid: 0,
  unboostedPaidCostRaw: 0n,
};

const MAX_EFFECTIVE_PERCENT = 99;

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

function totalFor(free: number, percent: number): number {
  return ceilDiv(free * 100, percent);
}

export function computeDiscountBatch(input: DiscountBatchInput): DiscountBatch {
  const { discountPercent, cap, perPoint, maxBoost, priceRaw, growthBps } = input;
  const potFree = Math.max(0, Math.floor(input.potFree));

  const free = Math.min(potFree, cap);
  if (discountPercent <= 0 || free <= 0) return { ...ZERO };

  const overflow = potFree > cap ? potFree - cap : 0;
  const boost = perPoint > 0 ? Math.min(maxBoost, Math.floor(overflow / perPoint)) : 0;
  const effectivePercent = Math.min(discountPercent + boost, MAX_EFFECTIVE_PERCENT);

  const total = totalFor(free, effectivePercent);
  const paid = total - free;

  const unboostedTotal = totalFor(free, Math.min(discountPercent, MAX_EFFECTIVE_PERCENT));
  const unboostedPaid = unboostedTotal - free;

  const paidCostRaw = geometricSumRaw(priceRaw, growthBps, paid);
  const usualCostRaw = geometricSumRaw(priceRaw, growthBps, total);

  return {
    free,
    total,
    paid,
    boost,
    effectivePercent,
    overflow,
    paidCostRaw,
    usualCostRaw,
    savingRaw: usualCostRaw - paidCostRaw,
    avgPricePaidRaw: paidCostRaw / BigInt(total),
    unboostedTotal,
    unboostedPaid,
    unboostedPaidCostRaw: geometricSumRaw(priceRaw, growthBps, unboostedPaid),
  };
}
