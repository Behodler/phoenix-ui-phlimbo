import type { Tab } from '../types/vault';

export interface VaultTabFlags {
  isMounted: boolean;
  isMainnet: boolean;
  /** Local Anvil (chain id 31337). */
  isLocal: boolean;
  /** Sepolia testnet (chain id 11155111). */
  isSepolia: boolean;
  hasAdminAccess: boolean;
}

/**
 * The VaultPage tab list, in display order.
 *
 * - Before mount: a fixed, network-agnostic list (prevents flicker).
 * - Testnet Faucet: non-mainnet only.
 * - Market (Uniswap V2 phUSD/sUSDS): every network, immediately before NFT.
 * - Admin: owner or allowlisted admin.
 */
export function getVaultTabs({ isMounted, isMainnet, hasAdminAccess }: VaultTabFlags): Tab[] {
  if (!isMounted) {
    return ["Mint", "Stake", "Yield Funnel"];
  }

  const tabList: Tab[] = ["Mint", "Stake", "Yield Funnel"];

  if (!isMainnet) {
    tabList.push("Testnet Faucet");
  }

  tabList.push("Market");

  tabList.push("NFT");

  if (hasAdminAccess) {
    tabList.push("Admin");
  }

  return tabList;
}
