import { CHAIN_IDS } from './networkDetection';

// Admin access allowlist keyed by chain ID
// Addresses in this list will see the Admin tab alongside contract owners
const ADMIN_ALLOWLIST: Record<number, string[]> = {
  [CHAIN_IDS.MAINNET]: [
    '0x186c77B80Bbfd21b01C7D7FA44bA27031322a77F',
    '0x630966B668b321Cc6441754f96519a55F72Cd476',
  ],
  [CHAIN_IDS.SEPOLIA]: [],
  [CHAIN_IDS.ANVIL]: [],
};

export function isAllowlistedAdmin(chainId: number | undefined, address: string | undefined): boolean {
  if (!chainId || !address) return false;
  const allowlist = ADMIN_ALLOWLIST[chainId];
  if (!allowlist) return false;
  return allowlist.some(a => a.toLowerCase() === address.toLowerCase());
}
