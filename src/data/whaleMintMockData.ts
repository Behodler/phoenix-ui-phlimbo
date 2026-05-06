import whalePhoenixImg from '../assets/whale-phoenix.png';

/**
 * Mock-only constants for the Whale Mint panel. When contracts are wired in
 * a later story, this file becomes the swap-out point — keep it small and
 * isolated.
 */
export const WHALE_MINT_MOCK = {
  batchSize: 40,
  potUsdc: 10, // current pot total — static; updated manually for now
  liquidSkyPhoenixId: 2, // matches nftMockData
  whaleArt: whalePhoenixImg,
} as const;

/**
 * Cyan accent used for the Whale Mint eyebrow text + pulsing dot. Scoped to
 * the WhaleMintPanel component only — do NOT register this as a global
 * theme token or apply it elsewhere in the UI.
 */
export const WHALE_MINT_CYAN = 'oklch(78% 0.13 220)';
