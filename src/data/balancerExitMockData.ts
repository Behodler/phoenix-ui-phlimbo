/**
 * MOCK fixture for the Balancer LP exit modal (`BalancerExitModal`).
 *
 * The numbers mirror `BalancerLPMigrator.previewMigrate(bptAmount)` from
 * `@behodler/phase2-wagmi-hooks@0.20.0`, in wei (18 decimals), so the live
 * wiring can swap this object for the decoded view result without reshaping.
 * The recovery-mode date is static copy and stay here once the modal is live.
 */

/** From this date the Balancer pool can only be exited via recovery mode. Static copy. */
export const BALANCER_RECOVERY_MODE_DATE = '30 October 2026';

export type LeftoverSymbol = 'sUSDS' | 'phUSD';

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

export const BALANCER_EXIT_MOCK: BalancerExitPreview = {
  bptAmount: 1_842_517_300_000_000_000_000n, // 1,842.5173 BPT
  sUSDSOut: 812_406_100_000_000_000_000n, // 812.4061 sUSDS
  phUSDOut: 1_021_884_550_000_000_000_000n, // 1,021.88455 phUSD
  sUSDSUsed: 812_406_100_000_000_000_000n,
  phUSDUsed: 996_312_040_000_000_000_000n,
  leftoverToken: 'phUSD',
  leftoverAmount: 25_572_510_000_000_000_000n, // 25.57251 phUSD
  recoveryMode: false,
  expectedLiquidity: 899_201_480_000_000_000_000n, // 899.20148 UNI-V2
};

/** Simulated wallet + block latency for each mock step. */
export const BALANCER_EXIT_MOCK_STEP_MS = 1400;
