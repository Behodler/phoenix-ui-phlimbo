/**
 * Forge tab STATIC CONFIG ONLY. Despite the filename, nothing here is a
 * simulated on-chain value: every Forge row is live (`useForgeAnnihilate`,
 * `useForgeHarvest`, `useForgeBonfire`), and only their tuning constants live here.
 * The one exception is `FORGE_BOOST_MOCK`, below.
 */

import type { AnnihilateStableSymbol } from '../hooks/useForgeAnnihilate';

/** Slippage applied to `minPhUSDOut` on `Antimatter.annihilate`. */
export const FORGE_ANNIHILATE_SLIPPAGE_BPS = 50;

/** `minEthOut` = simulated `ethOut` × 95%, the only slippage check `SYAHarvester.harvest` has. */
export const FORGE_HARVEST_MIN_OUT_BPS = 9500;

/** `minPayout` on `NFTBonfire.burn` = block-attested `pendingPayout()` × 98%. */
export const FORGE_BONFIRE_MIN_PAYOUT_BPS = 9800;
/** Preferred NFT for the Bonfire picker when the wallet holds one (`nftStaticConfig` id). */
export const FORGE_BONFIRE_DEFAULT_NFT_ID = 1; // EYE ignition

/** Keys of the Forge accordion rows. */
export type ForgeToolKey = 'annihilate' | 'annihilateBoostMock' | 'harvest' | 'bonfire';
/** Row opened on a first visit, before the user has made a choice. */
export const FORGE_DEFAULT_OPEN: ForgeToolKey = 'annihilate';
/**
 * localStorage key for the last open Forge row. Holds a row key, or
 * `FORGE_ALL_COLLAPSED` when the user closed every row.
 */
export const FORGE_OPEN_ROW_STORAGE_KEY = 'forge.openRow';
export const FORGE_ALL_COLLAPSED = 'none';

/**
 * MOCK values for the admin-only "Annihilate Antimatter (boost preview)" row.
 * Stand-ins for an `AntimatterBooster.previewBoost` read (antimatter:005, not
 * yet deployed): which stables are low on protocol-owned liquidity, and the
 * percentage of extra phUSD the boosted route pays. The live story swaps this
 * constant for that read.
 */
export const FORGE_BOOST_MOCK: { eligible: readonly AnnihilateStableSymbol[]; boostPct: number } = {
  eligible: ['USDe'],
  boostPct: 20,
};
