/**
 * Mainnet and Sepolia contract addresses.
 *
 * Both objects are copied verbatim from phStaging2 `server/deployments/` into
 * `src/types/generated/phStaging2/` — do not edit them here or there. A mainnet
 * address change lands in phStaging2's `mainnet-addresses.ts` (via its patch
 * scripts) and is re-copied. Anvil addresses are fetched at runtime instead
 * (see `addressFetcher.ts`).
 */
export { mainnetAddresses } from '../types/generated/phStaging2/mainnet-addresses'
export { sepoliaAddresses } from '../types/generated/phStaging2/sepolia-addresses'
