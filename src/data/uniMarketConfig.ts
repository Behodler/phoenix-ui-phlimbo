/**
 * Static configuration for the "Market" tab (stories 084, 085, 087).
 *
 * Nothing here is a balance, price or reserve: those are read live by
 * `useUniMarket` from the UniswapHelper, the phUSD/sUSDS and AM/sUSDS Uniswap
 * V2 pairs and the token contracts. This file holds only what the chain does not expose —
 * token metadata, the route labels the helper takes (it does not publish its
 * route), and UI constants.
 */
import type { ContractAddresses } from '../types/contracts';
import { mainnetAddresses } from '../lib/contracts';

export type SwapTokenSymbol = 'DOLA' | 'USDC' | 'USDe' | 'USDS' | 'sUSDS' | 'ETH';
/**
 * A UniswapHelper "target": a token with its own Uniswap V2 pair against sUSDS.
 * AM is Phoenix Antimatter (phStaging2 story 120).
 */
export type TargetSymbol = 'phUSD' | 'AM';
export type MarketSymbol = SwapTokenSymbol | TargetSymbol;
/** The non-target side of a swap: a routed token, or the other target (phUSD ↔ AM). */
export type CounterSymbol = SwapTokenSymbol | TargetSymbol;
export type AddTokenSymbol = 'USDS' | 'sUSDS';

/** Symbol of both pairs' LP token (phUSD/sUSDS and AM/sUSDS are each plain UNI-V2). */
export const LP_SYMBOL = 'UNI-V2';
export type LpSymbol = typeof LP_SYMBOL;

/** Anything that can be approved: a market token or the pair's LP token. */
export type ApprovableSymbol = MarketSymbol | LpSymbol;

/** `ContractAddresses` keys the tab reads token addresses from (note `Dola` / `SUSDS` casing). */
export type TokenAddressKey = Extract<keyof ContractAddresses, 'Dola' | 'USDC' | 'USDe' | 'USDS' | 'SUSDS' | 'PhUSD' | 'Antimatter'>;

export interface RouteHop {
  /** Token reached by this hop (on the way towards sUSDS). */
  to: SwapTokenSymbol;
  /** Venue label when travelling towards phUSD. */
  venue: string;
  /** Venue label when travelling away from phUSD. */
  venueRev: string;
}

export interface TokenMeta {
  sym: MarketSymbol;
  name: string;
  /** On-chain decimals (USDC is 6; everything else here is 18). */
  decimals: number;
  /** Display decimals. */
  dp: number;
  native: boolean;
  /** Where the token address lives in `ContractAddresses`; null for native ETH. */
  addressKey: TokenAddressKey | null;
  /** Hops from this token to sUSDS (empty = direct pair). */
  hops: readonly RouteHop[];
}

export interface SwapTokenMeta extends TokenMeta {
  sym: SwapTokenSymbol;
}

// Route labels mirror UniswapHelper.sol's routing table (phStaging2 @ 0554c02).
const H_SAVE: RouteHop = { to: 'sUSDS', venue: 'sUSDS deposit', venueRev: 'sUSDS redeem' };
const H_PSM: RouteHop = { to: 'USDS', venue: 'Sky PSM', venueRev: 'Sky PSM' };
const H_CURVE_DOLA: RouteHop = { to: 'USDC', venue: 'Curve DOLA metapool', venueRev: 'Curve DOLA metapool' };
const H_CURVE_USDE: RouteHop = { to: 'USDC', venue: 'Curve stableswap-ng', venueRev: 'Curve stableswap-ng' };
const H_V3_WETH: RouteHop = { to: 'USDC', venue: 'Uniswap V3 · 0.05% (WETH)', venueRev: 'Uniswap V3 · 0.05% (WETH)' };

export const TOKENS: Record<SwapTokenSymbol, SwapTokenMeta> = {
  DOLA: { sym: 'DOLA', name: 'Dola USD Stablecoin', decimals: 18, dp: 2, native: false, addressKey: 'Dola', hops: [H_CURVE_DOLA, H_PSM, H_SAVE] },
  USDC: { sym: 'USDC', name: 'USD Coin', decimals: 6, dp: 2, native: false, addressKey: 'USDC', hops: [H_PSM, H_SAVE] },
  USDe: { sym: 'USDe', name: 'Ethena USDe', decimals: 18, dp: 2, native: false, addressKey: 'USDe', hops: [H_CURVE_USDE, H_PSM, H_SAVE] },
  USDS: { sym: 'USDS', name: 'Sky Dollar', decimals: 18, dp: 2, native: false, addressKey: 'USDS', hops: [H_SAVE] },
  sUSDS: { sym: 'sUSDS', name: 'Savings USDS', decimals: 18, dp: 4, native: false, addressKey: 'SUSDS', hops: [] },
  ETH: { sym: 'ETH', name: 'Ether', decimals: 18, dp: 6, native: true, addressKey: null, hops: [H_V3_WETH, H_PSM, H_SAVE] },
};

export const PHUSD: TokenMeta = {
  sym: 'phUSD', name: 'Phoenix USD', decimals: 18, dp: 2, native: false, addressKey: 'PhUSD', hops: [],
};

/** Phoenix Antimatter. `AM` is its on-chain ticker; the Market tab shows the ticker. */
export const AM: TokenMeta = {
  sym: 'AM', name: 'Phoenix Antimatter', decimals: 18, dp: 2, native: false, addressKey: 'Antimatter', hops: [],
};

export const TARGETS: Record<TargetSymbol, TokenMeta> = { phUSD: PHUSD, AM };
/** Target picker order. */
export const TARGET_ORDER: readonly TargetSymbol[] = ['phUSD', 'AM'];
export const DEFAULT_TARGET: TargetSymbol = 'phUSD';

export function isTarget(sym: MarketSymbol): sym is TargetSymbol {
  return sym === 'phUSD' || sym === 'AM';
}

/** The target that is not `t`: the counter a phUSD ↔ AM swap trades against. */
export function otherTarget(t: TargetSymbol): TargetSymbol {
  return t === 'phUSD' ? 'AM' : 'phUSD';
}

/** UNI-V2 LP token decimals (always 18). */
export const LP_DECIMALS = 18;
export const LP_DP = 4;

export function metaOf(sym: MarketSymbol): TokenMeta {
  return isTarget(sym) ? TARGETS[sym] : TOKENS[sym];
}

/** Token picker order. */
export const ORDER: readonly SwapTokenSymbol[] = ['DOLA', 'USDC', 'USDe', 'USDS', 'sUSDS', 'ETH'];

/** The pair leg every route crosses (phUSD ↔ AM crosses it twice, via sUSDS). */
export const POOL_VENUE = 'Uniswap V2 · 0.30%';
/** Uniswap V2 pair fee (display). */
export const POOL_FEE = 0.003;

/**
 * Deposit tokens accepted by Add liquidity; USDS is wrapped to sUSDS by
 * UniswapHelper.addLiquidityUSDS / addLiquidityAMUSDS.
 */
export const ADD_TOKENS: readonly AddTokenSymbol[] = ['USDS', 'sUSDS'];
export const DEFAULT_ADD_TOKEN: AddTokenSymbol = 'USDS';
export const WRAP_VENUE = 'sUSDS deposit';

/** MAX on native ETH leaves this much behind for gas (ETH). */
export const ETH_GAS_RESERVE = 0.01;
export const ETH_GAS_RESERVE_WEI = 10_000_000_000_000_000n;

/** Price impact above which the swap CTA refuses to proceed. */
export const MAX_PRICE_IMPACT = 0.15;

export const SLIPPAGE_OPTIONS = [0.1, 0.5, 1] as const;
export const DEFAULT_SLIPPAGE = 0.5;
export const DEADLINE_MINUTES = 20;

/** Quick-pick fractions of the LP position on the Remove panel (1 = Max). */
export const REMOVE_PCTS = [0.25, 0.5, 0.75, 1] as const;

/** Token the sUSDS side of a removal is paid out in. */
export const REMOVE_OUT_TOKENS = ['sUSDS', 'USDS'] as const;
export type RemoveOutSymbol = (typeof REMOVE_OUT_TOKENS)[number];
export const DEFAULT_REMOVE_OUT: RemoveOutSymbol = 'sUSDS';

/** Label of the single spender every approval targets. */
export const HELPER_LABEL = 'UniswapHelper';

/** UniswapHelper write functions, as shown under each review step. */
export const HELPER_METHODS = {
  swapToPhUSD: 'swapToPhUSD',
  swapETHToPhUSD: 'swapETHToPhUSD',
  swapFromPhUSD: 'swapFromPhUSD',
  swapPhUSDToETH: 'swapPhUSDToETH',
  swapToAM: 'swapToAM',
  swapETHToAM: 'swapETHToAM',
  swapFromAM: 'swapFromAM',
  swapAMToETH: 'swapAMToETH',
  swapPhUSDToAM: 'swapPhUSDToAM',
  swapAMToPhUSD: 'swapAMToPhUSD',
  addLiquiditySUSDS: 'addLiquiditySUSDS',
  addLiquidityUSDS: 'addLiquidityUSDS',
  addLiquidityAMSUSDS: 'addLiquidityAMSUSDS',
  addLiquidityAMUSDS: 'addLiquidityAMUSDS',
  removeLiquiditySUSDS: 'removeLiquiditySUSDS',
  removeLiquidityUSDS: 'removeLiquidityUSDS',
  removeLiquidityAMSUSDS: 'removeLiquidityAMSUSDS',
  removeLiquidityAMUSDS: 'removeLiquidityAMUSDS',
} as const;
export type HelperMethod = keyof typeof HELPER_METHODS;

export const methodLabel = (m: HelperMethod): string => `${HELPER_LABEL}.${HELPER_METHODS[m]}`;

/**
 * Outbound link for users who want app.uniswap.org instead. Uses the real
 * mainnet sUSDS and phUSD addresses already held in src/lib/contracts.ts.
 */
export const UNISWAP_TRADE_URL =
  `https://app.uniswap.org/swap?chain=mainnet&inputCurrency=${mainnetAddresses.SUSDS}&outputCurrency=${mainnetAddresses.PhUSD}`;

/** Per-transaction explorer link; '' on chains without a public explorer (Anvil). */
export function explorerTxUrl(chainId: number | undefined, hash: string | undefined): string {
  if (!hash) return '';
  if (chainId === 1) return `https://etherscan.io/tx/${hash}`;
  if (chainId === 11155111) return `https://sepolia.etherscan.io/tx/${hash}`;
  return '';
}
