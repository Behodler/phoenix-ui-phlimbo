/**
 * Token artwork for the "Market (uni)" tab. Presentation only — no balances,
 * prices or addresses. DOLA follows the app-wide convention of the sDOLA art;
 * ETH has no asset in the repo, so it renders as a "Ξ" monogram chip.
 */
import type { MarketSymbol } from '../../../data/uniMarketMockData';
import phUSDIcon from '../../../assets/phUSD-nobackground.png';
import usdcIcon from '../../../assets/usdc-logo.svg';
import usdeIcon from '../../../assets/USDe.png';
import usdsIcon from '../../../assets/USDS.png';
import susdsIcon from '../../../assets/sUSDS.png';
import dolaIcon from '../../../assets/sDOLA.png';

export const TOKEN_ICONS: Partial<Record<MarketSymbol, string>> = {
  phUSD: phUSDIcon,
  USDC: usdcIcon,
  USDe: usdeIcon,
  USDS: usdsIcon,
  sUSDS: susdsIcon,
  DOLA: dolaIcon,
};

/** Monogram fallbacks for tokens without artwork. */
export const TOKEN_MONOGRAMS: Partial<Record<MarketSymbol, { mono: string; bg: string }>> = {
  ETH: { mono: 'Ξ', bg: '#5A6FD8' },
};
