/**
 * Static config for the Balancer LP exit modal (`BalancerExitModal`).
 *
 * Every figure the modal shows is a live `BalancerLPMigrator.previewMigrate`
 * read through `useBalancerExit`; only copy and constants live here.
 */

/** From this date the Balancer pool can only be exited via recovery mode. Static copy. */
export const BALANCER_RECOVERY_MODE_DATE = '30 October 2026';

/** Slippage applied to all four `migrate` minimums, in basis points. */
export const BALANCER_EXIT_SLIPPAGE_BPS = 50n;

export type LeftoverSymbol = 'sUSDS' | 'phUSD';

/** Decoded `previewMigrate(bptAmount)`, with the leftover token resolved to a symbol. 18-dec wei. */
export interface BalancerExitPreview {
  /** The holder's BPT balance, migrated in full. */
  bptAmount: bigint;
  /** Proportional (or recovery) exit from the Balancer pool. */
  sUSDSOut: bigint;
  phUSDOut: bigint;
  /** The part of each leg the Uniswap V2 pair accepts at its current ratio. */
  sUSDSUsed: bigint;
  phUSDUsed: bigint;
  /** Whichever leg did not fit the V2 ratio, refunded to the wallet. */
  leftoverToken: LeftoverSymbol;
  leftoverAmount: bigint;
  recoveryMode: boolean;
  /** UNI-V2 phUSD/sUSDS LP minted to the holder. */
  expectedLiquidity: bigint;
}
