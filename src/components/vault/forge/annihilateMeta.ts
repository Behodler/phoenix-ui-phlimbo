import type { AnnihilateStableSymbol } from '../../../hooks/useForgeAnnihilate';
import usdcIcon from '../../../assets/usdc-logo.svg';
import usdeIcon from '../../../assets/USDe.png';
import dolaIcon from '../../../assets/sDOLA.png';

/** Antimatter's accent colour in the Forge annihilate rows. */
export const ANTIMATTER_LAVENDER = '#C4AEEA';

/** Display name and icon of each pairable stablecoin, shared by the annihilate rows. */
export const STABLE_META: Record<AnnihilateStableSymbol, { name: string; icon: string }> = {
  USDC: { name: 'USD Coin', icon: usdcIcon },
  USDe: { name: 'Ethena USDe', icon: usdeIcon },
  DOLA: { name: 'DOLA', icon: dolaIcon },
};
