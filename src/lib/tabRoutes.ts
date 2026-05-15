import type { Tab } from '../types/vault';

// Friendly URL paths that deep-link into a specific tab on VaultPage.
// Only listed paths are deep-linkable; all other tabs are reachable only
// via the in-page TabNavigation and live at "/".
export const PATH_TO_TAB: Record<string, Tab> = {
  '/staking': 'Deposit',
  '/nft': 'NFT',
};

export const TAB_TO_PATH: Partial<Record<Tab, string>> = {
  Deposit: '/staking',
  NFT: '/nft',
};

// Default path used when the active tab has no friendly URL.
export const DEFAULT_PATH = '/';
