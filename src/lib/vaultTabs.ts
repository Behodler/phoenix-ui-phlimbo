import type { Tab } from '../types/vault';

export interface VaultTabFlags {
  isMounted: boolean;
  isMainnet: boolean;
  /** Local Anvil (chain id 31337). */
  isLocal: boolean;
  hasAdminAccess: boolean;
}

/**
 * The VaultPage tab list, in display order.
 *
 * - Before mount: a fixed, network-agnostic list (prevents flicker).
 * - Testnet Faucet: non-mainnet only.
 * - Market (Balancer): mainnet only.
 * - Market (uni) (stories 084, 087): until public launch, admin-only (owner or
 *   allowlisted admin) on public chains — mainnet, Sepolia, any non-local
 *   chain — and open to everyone on local Anvil. Sits immediately after Market.
 * - Admin: owner or allowlisted admin.
 */
export function getVaultTabs({ isMounted, isMainnet, isLocal, hasAdminAccess }: VaultTabFlags): Tab[] {
  if (!isMounted) {
    return ["Mint", "Stake", "Yield Funnel"];
  }

  const tabList: Tab[] = ["Mint", "Stake", "Yield Funnel"];

  if (!isMainnet) {
    tabList.push("Testnet Faucet");
  }

  // Market tab is only available on mainnet
  if (isMainnet) {
    tabList.push("Market");
  }

  if (isLocal || hasAdminAccess) {
    tabList.push("Market (uni)");
  }

  tabList.push("NFT");

  if (hasAdminAccess) {
    tabList.push("Admin");
  }

  return tabList;
}
