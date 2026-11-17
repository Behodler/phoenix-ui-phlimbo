/**
 * Display-only maths for the discount batch mint (nft-staking
 * `BatchNFTMinterNudgeDiscount`), used by the Whale-mock sub-tab.
 *
 * Everything the contract computes — `free`, `total`, `paid`, `paidCost`,
 * `boost`, `effectivePercent` — is read from `previewBatch()` / `previewBoost()`
 * and is NOT recomputed here. This module holds only the figures with no
 * contract equivalent, fed by those live values:
 *
 *   usual    = the price ramp over `total` NFTs (what that quantity costs
 *              through the normal mint)
 *   saving   = usual - paidCost
 *   avg      = paidCost / total
 *   unboosted comparison: the same `free` at `discountPercent` with no boost,
 *              total = ceil(free * 100 / discountPercent), paid = total - free
 *
 * The ramp `p * (10000 + g) / 10000` per step is the contract's own
 * (`geometricSumRaw` mirrors `_computeBatch`'s loop).
 */
import { geometricSumRaw } from './batchMintMath';

export interface DiscountDisplayInput {
  /** `previewBatch().free`. */
  free: number;
  /** `previewBatch().total`. */
  total: number;
  /** `previewBatch().paidCost` — authoritative. */
  paidCostRaw: bigint;
  /** Base `discountPercent()` (before any boost). */
  discountPercent: number;
  /** Current per-NFT price on the minter's dispatcher (raw). */
  priceRaw: bigint;
  /** Per-mint growth in basis points. */
  growthBps: number;
}

export interface DiscountDisplay {
  /** Price ramp over all `total` NFTs. */
  usualCostRaw: bigint;
  /** `usualCostRaw - paidCostRaw`, floored at 0. */
  savingRaw: bigint;
  /** `paidCostRaw / total`. */
  avgPricePaidRaw: bigint;
  /** Paid count of the same batch with boost = 0. */
  unboostedPaid: number;
  /** Price ramp over `unboostedPaid` NFTs. */
  unboostedPaidCostRaw: bigint;
}

const MAX_EFFECTIVE_PERCENT = 99;

const ZERO: DiscountDisplay = {
  usualCostRaw: 0n,
  savingRaw: 0n,
  avgPricePaidRaw: 0n,
  unboostedPaid: 0,
  unboostedPaidCostRaw: 0n,
};

export function computeDiscountDisplay(input: DiscountDisplayInput): DiscountDisplay {
  const { free, total, paidCostRaw, discountPercent, priceRaw, growthBps } = input;
  if (total <= 0 || free <= 0) return { ...ZERO };

  const usualCostRaw = geometricSumRaw(priceRaw, growthBps, total);
  const savingRaw = usualCostRaw > paidCostRaw ? usualCostRaw - paidCostRaw : 0n;

  const basePercent = Math.min(discountPercent, MAX_EFFECTIVE_PERCENT);
  const unboostedTotal = basePercent > 0 ? Math.ceil((free * 100) / basePercent) : 0;
  const unboostedPaid = Math.max(0, unboostedTotal - free);

  return {
    usualCostRaw,
    savingRaw,
    avgPricePaidRaw: paidCostRaw / BigInt(total),
    unboostedPaid,
    unboostedPaidCostRaw: geometricSumRaw(priceRaw, growthBps, unboostedPaid),
  };
}
