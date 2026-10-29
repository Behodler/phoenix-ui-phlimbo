/**
 * Forge tab config, plus the NFT Bonfire mock.
 *
 * Annihilate and Harvest Yield are live: `useForgeAnnihilate` and
 * `useForgeHarvest` read and write the chain, and only their tuning constants
 * live here. The NFT Bonfire row is still MOCK ONLY (no NFTBonfire contract
 * exists yet) and is shown to admins alone; everything below the Bonfire
 * heading is simulated.
 */

/** Slippage applied to `minPhUSDOut` on `Antimatter.annihilate`. */
export const FORGE_ANNIHILATE_SLIPPAGE_BPS = 50;

/** `minEthOut` = simulated `ethOut` × 95%, the only slippage check `SYAHarvester.harvest` has. */
export const FORGE_HARVEST_MIN_OUT_BPS = 9500;
/** Preferred claim NFT for the harvest picker when the wallet holds one. Token ID = dispatcher index. */
export const FORGE_HARVEST_DEFAULT_NFT_ID = 6; // Reservoir Ratchet

/** Bonfire mock: the wallet's claim-NFT holdings, tokenId → units held. */
export const FORGE_MOCK_NFT_HOLDINGS: Record<number, number> = { 6: 2, 1: 1, 5: 3, 2: 1, 3: 0, 4: 0 };

/**
 * NFT Bonfire mock. Stands in for `NFTBonfire.burn(uint256 tokenId, uint256 minPayout) returns (uint256 payout)`:
 * Antimatter accrues linearly at `ratePerDay`, capped at `maxPayout` (accrual above the cap is forfeited);
 * burning one of the caller's own claim NFTs pays out the whole pot and resets it to zero.
 *
 * Units (human-readable; 18 dp on-chain):
 *  - potInitial: Antimatter in the pot when the page loads
 *  - ratePerDay: Antimatter added to the pot per day (mirrors NFTBonfire.ratePerDay)
 *  - maxPayout:  pot cap in Antimatter (mirrors NFTBonfire.maxPayout)
 */
export const FORGE_BONFIRE_MOCK = {
  potInitial: 18.4062, // Antimatter in the pot when the page loads
  ratePerDay: 2.5, // mirrors NFTBonfire.ratePerDay (18 dp on-chain)
  maxPayout: 50, // mirrors NFTBonfire.maxPayout; accrual above it is forfeited
} as const;
export const FORGE_BONFIRE_MIN_PAYOUT_BPS = 9800; // minPayout = pot × 98%
export const FORGE_BONFIRE_DEFAULT_NFT_ID = 1; // EYE ignition

/** Keys of the Forge accordion rows. */
export type ForgeToolKey = 'annihilate' | 'harvest' | 'bonfire';
export const FORGE_DEFAULT_OPEN: ForgeToolKey = 'harvest';
