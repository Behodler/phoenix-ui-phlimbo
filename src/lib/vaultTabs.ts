import type { Tab } from '../types/vault';

export interface VaultTabFlags {
  isMounted: boolean;
  isMainnet: boolean;
  hasAdminAccess: boolean;
}

/**
 * The VaultPage tab list, in display order.
 *
 * - Before mount: a fixed, network-agnostic list (prevents flicker).
 * - Testnet Faucet: non-mainnet only.
 * - Market (Balancer): mainnet only.
 * - Market (uni) (story 084, mocked preview): every non-mainnet chain for
 *   everyone; on mainnet only for admins, so the public never sees fake
 *   balances or swaps. Sits immediately after Market.
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

  // Market tab is only available on mainnet
  if (isMainnet) {
    tabList.push("Market");
  }

  if (!isMainnet || hasAdminAccess) {
    tabList.push("Market (uni)");
  }

  tabList.push("NFT");

  if (hasAdminAccess) {
    tabList.push("Admin");
  }

  return tabList;
}
