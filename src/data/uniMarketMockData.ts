/**
 * ============================================================================
 *  NOTHING HERE IS LIVE.
 * ============================================================================
 *
 * Mock inputs for the "Market (uni)" tab (story 084) — a design preview of the
 * Uniswap V2 phUSD/sUSDS market that will replace the Balancer Market tab.
 *
 * Every reserve, balance, price and approval below is a static placeholder
 * copied from the design mockup
 * (product-owner scratchpad: planning-docs/phoenix/phlimbo-ui/MarketPostUniCutoverMock/Main.dc.html;
 * the LP position and Remove liquidity from MarketPostUniCutoverMockV2/Main.dc.html, story 085).
 * Nothing is read from or sent to a chain. The contract / method names in
 * SPENDERS and METHODS are design placeholders too: the live-wiring story will
 * replace this file and `useUniMarketMock` with real contract reads/writes and
 * leave the components alone.
 *
 * The one non-mocked value is UNISWAP_TRADE_URL, a plain outbound link to
 * app.uniswap.org that only opens a page.
 *
 * Units are human-readable floats (no wei) — this is a display-only mock.
 */
import { mainnetAddresses } from '../lib/contracts';

/** sUSDS → USD price (Sky savings rate accrual). */
export const SPX = 1.0735;

/** Static phUSD/sUSDS Uniswap V2 pair reserves. */
export const POOL = { rPh: 400000, rS: 369600 } as const;

/** Mock connected-wallet phUSD balance. */
export const PH_BAL = 3118.42;

/** Uniswap V2 pair fee. */
export const POOL_FEE = 0.003;
export const POOL_VENUE = 'Uniswap V2 · 0.30%';

/** MAX on native ETH leaves this much behind for gas. */
export const ETH_GAS_RESERVE = 0.01;

/** Price impact above which the swap CTA refuses to proceed. */
export const MAX_PRICE_IMPACT = 0.15;

/** Simulated wallet confirmation delay per review step. */
export const MOCK_STEP_MS = 1400;

export const SLIPPAGE_OPTIONS = [0.1, 0.5, 1] as const;
export const DEFAULT_SLIPPAGE = 0.5;
export const DEADLINE_MINUTES = 20;

export type SwapTokenSymbol = 'DOLA' | 'USDC' | 'USDe' | 'USDS' | 'sUSDS' | 'ETH';
export type MarketSymbol = SwapTokenSymbol | 'phUSD';
export type AddTokenSymbol = 'USDS' | 'sUSDS';

export interface RouteHop {
  /** Token reached by this hop (on the way towards sUSDS). */
  to: SwapTokenSymbol;
  /** Venue label when travelling towards phUSD. */
  venue: string;
  /** Venue label when travelling away from phUSD. */
  venueRev: string;
  /** Fractional fee charged by this hop. */
  fee: number;
}

export interface MockToken {
  sym: SwapTokenSymbol;
  name: string;
  bal: number;
  /** USD value of one unit. */
  usd: number;
  native: boolean;
  /** Display decimals. */
  dp: number;
  /** Hops from this token to sUSDS (empty = direct pair). */
  hops: readonly RouteHop[];
}

const H_SAVE: RouteHop = { to: 'sUSDS', venue: 'Sky savings deposit', venueRev: 'Sky savings redeem', fee: 0 };
const H_PSM: RouteHop = { to: 'USDS', venue: 'Sky PSM 1:1', venueRev: 'Sky PSM 1:1', fee: 0 };
const H_CURVE_USDC: RouteHop = { to: 'USDC', venue: 'Curve · 0.01%', venueRev: 'Curve · 0.01%', fee: 0.0001 };
const H_V3_USDC: RouteHop = { to: 'USDC', venue: 'Uniswap V3 · 0.05%', venueRev: 'Uniswap V3 · 0.05%', fee: 0.0005 };

export const TOKENS: Record<SwapTokenSymbol, MockToken> = {
  DOLA: { sym: 'DOLA', name: 'Dola USD Stablecoin', bal: 2450, usd: 1, native: false, dp: 2, hops: [H_CURVE_USDC, H_PSM, H_SAVE] },
  USDC: { sym: 'USDC', name: 'USD Coin', bal: 1200, usd: 1, native: false, dp: 2, hops: [H_PSM, H_SAVE] },
  USDe: { sym: 'USDe', name: 'Ethena USDe', bal: 0, usd: 1, native: false, dp: 2, hops: [H_CURVE_USDC, H_PSM, H_SAVE] },
  USDS: { sym: 'USDS', name: 'Sky Dollar', bal: 640.5, usd: 1, native: false, dp: 2, hops: [H_SAVE] },
  sUSDS: { sym: 'sUSDS', name: 'Savings USDS', bal: 812.4, usd: SPX, native: false, dp: 4, hops: [] },
  ETH: { sym: 'ETH', name: 'Ether', bal: 1.284, usd: 2580, native: true, dp: 6, hops: [H_V3_USDC, H_PSM, H_SAVE] },
};

/** Token picker order. */
export const ORDER: readonly SwapTokenSymbol[] = ['DOLA', 'USDC', 'USDe', 'USDS', 'sUSDS', 'ETH'];

/** Deposit tokens accepted by Add liquidity; USDS is wrapped to sUSDS by the liquidity zap. */
export const ADD_TOKENS: readonly AddTokenSymbol[] = ['USDS', 'sUSDS'];
export const DEFAULT_ADD_TOKEN: AddTokenSymbol = 'USDS';
export const WRAP_VENUE = 'Sky savings deposit';

/**
 * Spenders an approval can target. Approvals are tracked per token+spender,
 * because phUSD approved to the router is not phUSD approved to the zap.
 * Labels are placeholders until the Anvil deployment names the contracts.
 */
export const SPENDERS = {
  router: 'UniswapV2Router02',
  swapZap: '[ZAP_ROUTER]',
  zap: '[LIQUIDITY_ZAP]',
} as const;
export type SpenderKey = keyof typeof SPENDERS;

/** Symbol of the phUSD/sUSDS Uniswap V2 pair's LP token. */
export const LP_SYMBOL = 'UNI-V2';
export type LpSymbol = typeof LP_SYMBOL;

/** Anything that can be approved: a market token or the pair's LP token. */
export type ApprovableSymbol = MarketSymbol | LpSymbol;

export const approvalKey = (sym: ApprovableSymbol, spender: SpenderKey): string => `${sym}@${spender}`;

/** Contract call labels shown under each review step (placeholders). */
export const METHODS = {
  routerSwapExactIn: 'router.swapExactTokensForTokens',
  routerSwapExactOut: 'router.swapTokensForExactTokens',
  zapSwapToPhUSD: 'zap.swapToPhUSD',
  zapSwapETHToPhUSD: 'zap.swapETHToPhUSD',
  zapSwapFromPhUSD: 'zap.swapFromPhUSD',
  zapSwapPhUSDToETH: 'zap.swapPhUSDToETH',
  routerAddLiquidity: 'router.addLiquidity',
  zapAddLiquidityWithUSDS: 'zap.addLiquidityWithUSDS',
  routerRemoveLiquidity: 'router.removeLiquidity',
  zapRemoveLiquidityToUSDS: 'zap.removeLiquidityToUSDS',
} as const;

/** Mock connected-wallet UNI-V2 (LP) balance at load. */
export const LP_BAL = 1200;

/** Quick-pick fractions of the LP position on the Remove panel (1 = Max). */
export const REMOVE_PCTS = [0.25, 0.5, 0.75, 1] as const;

/**
 * Token the sUSDS side of a removal is paid out in. sUSDS comes straight from
 * the router; USDS goes through the liquidity zap, which redeems sUSDS → USDS.
 */
export const REMOVE_OUT_TOKENS = ['sUSDS', 'USDS'] as const;
export type RemoveOutSymbol = (typeof REMOVE_OUT_TOKENS)[number];
export const DEFAULT_REMOVE_OUT: RemoveOutSymbol = 'sUSDS';

/**
 * Approvals at load. DOLA and ETH start approved (as in the mockup); everything
 * else — including USDS on both the router and the liquidity zap, and UNI-V2
 * on both the router and the liquidity zap — does not.
 */
export const INITIAL_APPROVALS: Readonly<Record<string, boolean>> = {
  [approvalKey('DOLA', 'swapZap')]: true,
  [approvalKey('ETH', 'swapZap')]: true,
};

/**
 * Outbound link for users who want app.uniswap.org instead. Uses the real
 * mainnet sUSDS and phUSD addresses already held in src/lib/contracts.ts.
 */
export const UNISWAP_TRADE_URL =
  `https://app.uniswap.org/swap?chain=mainnet&inputCurrency=${mainnetAddresses.SUSDS}&outputCurrency=${mainnetAddresses.PhUSD}`;

/** Success-state explorer link (mock — there is no transaction hash). */
export const ETHERSCAN_URL = 'https://etherscan.io';
