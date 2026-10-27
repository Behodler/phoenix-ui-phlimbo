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

/** Keys of the Forge accordion rows. Stories 089/090 extend this union. */
export type ForgeToolKey = 'annihilate';
export const FORGE_DEFAULT_OPEN: ForgeToolKey = 'annihilate';
