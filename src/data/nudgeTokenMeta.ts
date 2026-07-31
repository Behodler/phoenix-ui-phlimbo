import whalePhoenixImg from '../assets/whale-phoenix.png';
import usdcLogo from '../assets/usdc-logo.svg';
import usdsLogo from '../assets/USDS.png';
import kenduLogo from '../assets/KENDU.png';
import phUsdLogo from '../assets/phUSD-nobackground.png';
import sDolaLogo from '../assets/sDOLA.png';
import usdeLogo from '../assets/USDe.png';
import flaxLogo from '../assets/Flax.webp';
import eyeLogo from '../assets/EYE.webp';
import scxLogo from '../assets/SCX.webp';

/**
 * Presentation metadata for nudge reward tokens.
 *
 * This module holds **static per-token presentation only** — art, external
 * link, and which USD price source applies. The *set* of reward tokens is
 * never listed here: it is read live from
 * `BatchNFTMinterMultiToken.getNudgeTokens()` (see `useNudgePot`), so switching
 * chains re-reads the whitelist from that chain's minter and the strip adapts
 * on its own. A token that gets whitelisted later and has no entry below still
 * renders — it just falls back to a lettered circle with no link and no USD
 * value.
 *
 * Keys are CANONICAL symbols (see `canonicalSymbol`), not addresses, so one
 * entry covers a token across every chain — including Anvil, where the mocks
 * carry an `m` prefix (`mUSDC`, `mKENDU`).
 */

/** How a token's USD value is obtained. */
export type NudgePriceSource =
  /** Hard-coded $1. USD stablecoins only. */
  | 'stable'
  /** Balancer spot price via `useBalancerPrice` — the same figure the staking APYs use. */
  | 'phusd'
  /** CoinGecko spot, fetched once on page load via `useKenduPrice`. */
  | 'kendu';

export interface NudgeTokenMeta {
  /** Ticker as rendered under the amount — the real-world casing, not the mock's. */
  display: string;
  /** Bundled logo art. Absent ⇒ the chip falls back to a lettered circle. */
  logo?: string;
  /**
   * External link for the chip. When present the chip becomes an anchor and
   * picks up the sheen + coin-flip treatment that advertises it as clickable.
   * Chain-independent by design: the KENDU CoinGecko page and the phUSD site
   * describe the token, not a particular deployment.
   */
  url?: string;
  /** Omitted ⇒ we have no price for this token and its leg is excluded from the pot total. */
  priceSource?: NudgePriceSource;
}

/**
 * Canonical symbols we know how to present. Order is irrelevant — the render
 * order always comes from the on-chain whitelist.
 */
export const NUDGE_TOKEN_META: Readonly<Record<string, NudgeTokenMeta>> = {
  USDC: { display: 'USDC', logo: usdcLogo, priceSource: 'stable' },
  USDS: { display: 'USDS', logo: usdsLogo, priceSource: 'stable' },
  PHUSD: {
    display: 'phUSD',
    logo: phUsdLogo,
    url: 'https://phoenix.behodler.io',
    priceSource: 'phusd',
  },
  KENDU: {
    display: 'KENDU',
    logo: kenduLogo,
    url: 'https://www.coingecko.com/en/coins/kendu',
    priceSource: 'kendu',
  },
  // Plausible future whitelist entries. Art only — we have no price feed for
  // these here, so their legs are shown but left out of the pot total.
  SDOLA: { display: 'sDOLA', logo: sDolaLogo },
  USDE: { display: 'USDe', logo: usdeLogo },
  FLAX: { display: 'FLAX', logo: flaxLogo },
  EYE: { display: 'EYE', logo: eyeLogo },
  SCX: { display: 'SCX', logo: scxLogo },
};

/**
 * Reduce an on-chain `symbol()` to the canonical key used by
 * `NUDGE_TOKEN_META`.
 *
 * Anvil deploys mock ERC20s whose symbols carry an `m` prefix (`mUSDC`,
 * `mKENDU`) while mainnet uses the bare ticker. Upper-casing and stripping a
 * leading `M` — but only when the remainder is a symbol we actually know —
 * makes one metadata table serve both. The guard matters: stripping
 * unconditionally would turn a genuine `MKR` into `KR`.
 */
export function canonicalSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper in NUDGE_TOKEN_META) return upper;
  if (upper.length > 1 && upper.startsWith('M')) {
    const stripped = upper.slice(1);
    if (stripped in NUDGE_TOKEN_META) return stripped;
  }
  return upper;
}

/** Metadata for an on-chain symbol, or `undefined` when the token is unknown to us. */
export function nudgeTokenMeta(symbol: string): NudgeTokenMeta | undefined {
  return NUDGE_TOKEN_META[canonicalSymbol(symbol)];
}

/** Pixel-art shared by the panel's left column and its NFT chip. */
export const WHALE_ART = whalePhoenixImg;

/** Payment-token art for the "You pay" chip. Liquid Sky Phoenix is priced in USDS. */
export const WHALE_PAYMENT_LOGO = usdsLogo;

/**
 * Cyan accent shared with the Whale Mint banner (eyebrow text, pulsing dot and
 * the NFT chip's tint) and with `FeaturedProjectBanner`, where it highlights the
 * "Mint a whale batch…" reward sentence. Scoped to those three surfaces — all
 * of them whale-mint reward UI — do NOT promote it to a global theme token.
 */
export const WHALE_DISCOUNT_CYAN = 'oklch(78% 0.13 220)';
