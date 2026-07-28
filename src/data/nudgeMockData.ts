import whalePhoenixImg from '../assets/whale-phoenix.png';
import usdcLogo from '../assets/usdc-logo.svg';
import kenduLogo from '../assets/KENDU.png';
import sDolaLogo from '../assets/sDOLA.png';
import usdeLogo from '../assets/USDe.png';
import flaxLogo from '../assets/Flax.png';
import usdsLogo from '../assets/USDS.png';

/**
 * Multi-token nudge reward pot — MOCK FIXTURE.
 *
 * All values here are UI-only placeholders. **No contract is wired.** The
 * multi-token nudge reward does not exist on chain yet: `nft-staking:022`
 * (`BatchNFTMinterMultiToken`) and `nft-staking:025` (owner-managed nudge-token
 * whitelist exposing `getNudgeTokens()` plus a positional `minRewards` array)
 * are still in review. This module exists so the redesigned banner can be
 * reviewed on the live dapp behind the admin gate before any wiring lands.
 *
 * Shape note — `tokens` is an ORDERED array and the index is meaningful. The
 * eventual live version reads the whitelist via `getNudgeTokens()` and passes a
 * positional `minRewards` array ordered to match, so keeping the fixture
 * positional makes the follow-up wiring story a data-source swap rather than a
 * rewrite. Render order is array order — never sort by USD value at render time.
 *
 * Units:
 *  - `amountFormatted`: already-formatted human-readable token amount (display
 *    string, matching the design mockup exactly — not wei, not a number)
 *  - `usd`: approximate USD value of that token leg, plain number, summed at
 *    render time to produce the aggregate "Pot value" figure
 */
export interface NudgeMockToken {
  /** Uppercase ticker rendered under the amount. */
  symbol: string;
  /**
   * Bundled logo art. Optional: the live version will hit whitelisted nudge
   * tokens with no art in `src/assets/`, and the panel falls back to a
   * lettered circle. Every token in this fixture has real art.
   */
  logo?: string;
  /** Pre-formatted display amount, e.g. `12,480.00`. */
  amountFormatted: string;
  /** Approximate USD value of this leg. */
  usd: number;
  /**
   * Optional external link for the token — a price page, project site or block
   * explorer. Purely presentational metadata: when set (and non-empty) the chip
   * becomes an anchor that opens in a new tab, and picks up the sheen + coin
   * flip treatment that advertises it as clickable. When absent the chip is an
   * inert div with no animation, which is the default for whitelisted tokens
   * we have no link for.
   */
  url?: string;
}

export const NUDGE_MOCK = {
  /** Batch size the whale mint buys in one transaction. */
  nftCount: 40,
  /** Collection name shown on the NFT chip. */
  nftCollectionName: 'Liquid Sky Phoenix',
  /** Pre-formatted one-off mint cost, including the payment token symbol. */
  mintCostFormatted: '25,000.00 USDS',
  /**
   * Same figure as a plain number, used for the "Net cost" subtraction. The
   * payment token is a USD stablecoin, so 1 unit is treated as $1 and the
   * amount doubles as its own USD value — do NOT reuse this assumption for a
   * non-stable payment token.
   */
  mintCostUsd: 25000,
  /** Payment token art, shown on the single "You pay" chip. */
  mintTokenLogo: usdsLogo,
  /** Pixel-art used for the banner's left column and the NFT chip. */
  whaleArt: whalePhoenixImg,
  /**
   * The reward pot, in whitelist order. The design mockup clamps this list to
   * 1–5 entries; the panel renders a single token without a dangling `+` and
   * scrolls horizontally beyond five.
   */
  tokens: [
    { symbol: 'USDC', logo: usdcLogo, amountFormatted: '12,480.00', usd: 12480 },
    {
      symbol: 'KENDU',
      logo: kenduLogo,
      amountFormatted: '118,000',
      usd: 6294,
      url: 'https://www.coingecko.com/en/coins/kendu',
    },
    { symbol: 'sDOLA', logo: sDolaLogo, amountFormatted: '1,904.20', usd: 1942 },
    { symbol: 'USDe', logo: usdeLogo, amountFormatted: '980.00', usd: 980 },
    { symbol: 'FLAX', logo: flaxLogo, amountFormatted: '48,000.00', usd: 1104 },
  ] as readonly NudgeMockToken[],
} as const;

/**
 * Cyan accent shared with the Whale Mint banner (eyebrow text, pulsing dot and
 * the NFT chip's tint). Scoped to these two panels — do NOT promote it to a
 * global theme token.
 */
export const NUDGE_MOCK_CYAN = 'oklch(78% 0.13 220)';
