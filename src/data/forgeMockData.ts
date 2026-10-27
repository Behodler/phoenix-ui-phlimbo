/**
 * Forge tab mock data — MOCK ONLY.
 *
 * Every number the Forge tab shows comes from this module. Nothing here reads
 * the chain, and no Forge component calls a contract: buttons step through
 * their visual states locally and fire an info toast saying nothing was sent.
 * A later live-wiring story replaces these constants with real hooks, so the
 * values are shaped like the contract surfaces they stand in for (human-
 * readable units, no wei / no basis-point scaling beyond the slippage field).
 *
 * Units:
 *  - FORGE_MOCK_PHUSD_PRICE:        phUSD market price in USD (raw — the
 *                                   annihilate gate compares this against
 *                                   ANNIHILATE_PRICE_FLOOR; never clamp it)
 *  - FORGE_MOCK_ANTIMATTER_BALANCE: the connected wallet's Antimatter balance
 *  - FORGE_MOCK_STABLE_BALANCES:    wallet balances of the stablecoins
 *                                   registered with the phUSD minter
 *  - FORGE_ANNIHILATE_SLIPPAGE_BPS: slippage applied to minPhUSDOut
 */

export const FORGE_MOCK_PHUSD_PRICE = 0.98; // raw price; gate compares against ANNIHILATE_PRICE_FLOOR
export const FORGE_MOCK_ANTIMATTER_BALANCE = 142.38;
export const FORGE_MOCK_STABLE_BALANCES = { USDC: 1250, USDe: 80, DOLA: 410.25 } as const;
export const FORGE_ANNIHILATE_SLIPPAGE_BPS = 50; // minPhUSDOut = 2·amount·(1 − 0.5%)

/**
 * Harvest Yield (SYA harvester) mock. Stands in for
 * `SYAHarvester.harvest(address[] exemptStrategies, uint256 nftIndex, uint256 minEthOut)`.
 *
 * Units:
 *  - yieldUsd: yield claimable from the Yield Funnel, USD
 *  - ethOut:   ETH paid to the caller by the harvest, ETH
 *  - gasEth:   estimated gas cost of the harvest tx, ETH (= gasUnits × gasGwei)
 *  - gasUnits: gas units; gasGwei: gas price in gwei
 * Profit = ethOut − gasEth; profitable iff ethOut > gasEth.
 */
export const FORGE_HARVEST_REQUIRES_NFT = true; // flip to false once SYA NFT gating is removed
export type ForgeHarvestScenario = 'profitable' | 'unprofitable';
export const FORGE_HARVEST_SCENARIO: ForgeHarvestScenario = 'profitable';
export const FORGE_HARVEST_MOCK = {
  profitable: { yieldUsd: 412.8, ethOut: 0.0421, gasEth: 0.0026, gasUnits: 640_000, gasGwei: 4.1 },
  unprofitable: { yieldUsd: 14.2, ethOut: 0.0019, gasEth: 0.0026, gasUnits: 640_000, gasGwei: 4.1 },
} as const;
export const FORGE_MOCK_ETH_USD = 3500;
export const FORGE_HARVEST_MIN_OUT_BPS = 9500; // minEthOut = ethOut × 95%
/** Claim-NFT holdings of the connected wallet: tokenId → units held. Token ID = dispatcher index. */
export const FORGE_MOCK_NFT_HOLDINGS: Record<number, number> = { 6: 2, 1: 1, 5: 3, 2: 1, 3: 0, 4: 0 };
export const FORGE_HARVEST_DEFAULT_NFT_ID = 6; // Reservoir Ratchet

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
