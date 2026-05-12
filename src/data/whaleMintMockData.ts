import whalePhoenixImg from '../assets/whale-phoenix.png';

/**
 * Presentational constants for the Whale Mint panel. All numeric values
 * (batch size, reward pot, mint cost) now come from on-chain reads, so
 * only the art import and the cyan accent live here.
 */
export const WHALE_MINT_MOCK = {
  whaleArt: whalePhoenixImg,
} as const;

/**
 * Cyan accent used for the Whale Mint eyebrow text + pulsing dot. Scoped to
 * the WhaleMintPanel component only — do NOT register this as a global
 * theme token or apply it elsewhere in the UI.
 */
export const WHALE_MINT_CYAN = 'oklch(78% 0.13 220)';
