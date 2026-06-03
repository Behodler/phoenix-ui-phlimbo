import type { Tab } from '../types/vault';

// Friendly URL paths that deep-link into a specific tab on VaultPage.
// Only listed paths are deep-linkable; all other tabs are reachable only
// via the in-page TabNavigation and live at "/".
export const PATH_TO_TAB: Record<string, Tab> = {
  '/stake': 'Stake',
  // Repointed from 'Deposit' → 'Stake'. DeFi Llama deep-links to /staking, so
  // that external link must land on the new consolidated Stake surface.
  '/staking': 'Stake',
  '/nft': 'NFT',
};

export const TAB_TO_PATH: Partial<Record<Tab, string>> = {
  // Canonical path for the Stake tab (story 069); in-app Stake clicks navigate
  // here. DeFi Llama deep-links to /staking, so the canonical outbound path is
  // /staking. /stake remains a working alias in PATH_TO_TAB above.
  Stake: '/staking',
  NFT: '/nft',
};

// Default path used when the active tab has no friendly URL.
export const DEFAULT_PATH = '/';
