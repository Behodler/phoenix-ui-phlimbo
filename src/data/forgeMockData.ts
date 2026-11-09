/**
 * Forge tab STATIC CONFIG ONLY. Despite the filename, nothing here is a
 * simulated on-chain value: every Forge row is live (`useForgeAnnihilate`,
 * `useForgeHarvest`, `useForgeBonfire`), and only their tuning constants live here.
 */

/** Slippage applied to `minPhUSDOut` on `Antimatter.annihilate`. */
export const FORGE_ANNIHILATE_SLIPPAGE_BPS = 50;

/** `minEthOut` = simulated `ethOut` × 95%, the only slippage check `SYAHarvester.harvest` has. */
export const FORGE_HARVEST_MIN_OUT_BPS = 9500;
/** Preferred claim NFT for the harvest picker when the wallet holds one. Token ID = dispatcher index. */
export const FORGE_HARVEST_DEFAULT_NFT_ID = 6; // Reservoir Ratchet

/** `minPayout` on `NFTBonfire.burn` = block-attested `pendingPayout()` × 98%. */
export const FORGE_BONFIRE_MIN_PAYOUT_BPS = 9800;
/** Preferred NFT for the Bonfire picker when the wallet holds one (`nftStaticConfig` id). */
export const FORGE_BONFIRE_DEFAULT_NFT_ID = 1; // EYE ignition

/** Keys of the Forge accordion rows. */
export type ForgeToolKey = 'annihilate' | 'harvest' | 'bonfire';
export const FORGE_DEFAULT_OPEN: ForgeToolKey = 'harvest';
