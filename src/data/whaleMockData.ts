/**
 * UI-only placeholders for the Whale-mock preview of the nft-staking
 * `BatchNFTMinterNudgeDiscount` batch mint (admin-only sub-tab).
 *
 * Nothing here is read from chain. Contract defaults follow nft-staking
 * `d7eb782`; `maxBoost` is mocked ON (the chain ships it at 0, see
 * phStaging2:135) so the boosted state can be previewed at all.
 *
 * The only live input the mock uses is the index-4 (Liquid Sky Phoenix) price
 * and growth from `useMinterPageView().USDS`. The `fallback*` values below are
 * used only while that loads or when the row is missing.
 */
export const WHALE_MOCK = {
  /** UI-only placeholder. Contract: 0 (off) or 50..99, default 50. */
  discountPercent: 50,
  /** UI-only placeholder. `maxFreePerBatch`, the gas-safety cap on free NFTs per batch. Contract default 50. */
  maxFreePerBatch: 50,
  /** UI-only placeholder. Free-equivalents past the cap per +1 discount point. Contract default 3. */
  overflowNFTsPerBoostPoint: 3,
  /** UI-only placeholder. Chain default 0 (boost disabled); mocked on to show the boost. Contract bound 49. */
  maxBoost: 10,
  /** UI-only placeholder. Free-NFT equivalents the fund covers with the debug switch OFF (below the cap). */
  normalPotFree: 12,
  /** UI-only placeholder. Debug switch ON: cap reached, overflow 30 → boost 10. */
  boostedPotFree: 80,
  /**
   * UI-only placeholder. Per-NFT index-4 price in USDS (18 decimals), used only
   * when `useMinterPageView` has no USDS row. 10 USDS is the index-4 initial
   * price phStaging2 `DeployMocks.s.sol` registers on Anvil.
   */
  fallbackPriceUsds: '10',
  /** UI-only placeholder. Index-4 growth in basis points (0.1%), as registered by `DeployMocks.s.sol`. */
  fallbackGrowthBps: 10,
  /** Decimals of USDS, the index-4 payment token. */
  paymentDecimals: 18,
} as const;
