/**
 * Literals for the **"Stake (mock)" tab** — a deliberately fake preview of the
 * Antimatter overhaul of `stable-staker` (story 079).
 *
 * NOTHING HERE IS LIVE. No contract, no wagmi hook, no RPC call feeds any of
 * these numbers; they are literals advanced by a timer so the design can be
 * contrasted side by side with the real `Stake` tab. This surface must never be
 * wired to contracts — a real Antimatter tab would be a new surface, not this
 * one with its literals swapped out.
 *
 * Units are human-readable throughout (no wei, no basis points).
 */

/**
 * Ticker for the Antimatter accrual token. Fixed here as a single constant so
 * the real overhaul landing on a different symbol is a one-line change.
 */
export const ANTIMATTER_SYMBOL = 'aUSD';

/**
 * Accrual multiplier. Real APYs move a per-second counter too slowly to read,
 * so the mock runs the clock fast enough that the digits visibly turn.
 */
export const DEMO_SPEED = 400;

export const SECONDS_PER_YEAR = 31_536_000;

/** Lavender accent applied to the trailing digits of Antimatter figures. */
export const ANTIMATTER_ACCENT = 'rgba(196,174,234,.95)';

/** Yellow accent applied to the trailing digits of the phUSD payout figure. */
export const PHUSD_ACCENT = 'rgba(255,217,61,.92)';

/** Solid orange used for phUSD values on the right of a before/after arrow. */
export const PHUSD_ARROW_ACCENT = '#FFB566';

/** Which form the expanded panel of a pool row is showing. */
export type AntimatterSubTab = 'stake' | 'withdraw' | 'annihilate';

/** Keys into the mock wallet. */
export type AntimatterWalletKey = 'phusd' | 'usdc' | 'usde' | 'dola' | 'am';

export interface AntimatterMockWallet {
  phusd: number;
  usdc: number;
  usde: number;
  dola: number;
  /** Antimatter held loose in the wallet (surplus from an over-accrued annihilation). */
  am: number;
}

export interface AntimatterMockPool {
  id: string;
  symbol: string;
  apy: number;
  /** Stablecoin currently staked in this pool. */
  staked: number;
  /** Which mock wallet balance this pool spends and refunds. */
  walletKey: AntimatterWalletKey;
  /** Antimatter accrued as of `t0`; accrual continues from here. */
  amBase: number;
  /** Epoch ms the current `amBase` was frozen at; 0 means "the tab's origin". */
  t0: number;
  tagline: string;
  /** Raw text of the Stake form's amount input. */
  stakeAmt: string;
  /** Raw text of the Withdraw form's amount input. */
  wdAmt: string;
  /**
   * Which sub-tab this pool's expanded panel shows. Annihilation is the
   * default: it is the idea the whole mock exists to communicate, so it is
   * what a visitor sees first.
   */
  tab: AntimatterSubTab;
}

export const ANTIMATTER_MOCK_WALLET: AntimatterMockWallet = {
  phusd: 1240.5,
  usdc: 2450.32,
  usde: 830.11,
  dola: 500,
  am: 0,
};

export const ANTIMATTER_MOCK_POOLS: AntimatterMockPool[] = [
  {
    id: 'usdc',
    symbol: 'USDC',
    apy: 14.2,
    staked: 100,
    walletKey: 'usdc',
    amBase: 12.481922,
    t0: 0,
    stakeAmt: '',
    wdAmt: '',
    tab: 'annihilate',
    tagline: 'Stake USDC into the yield-bearing TVL pool, accrue Antimatter.',
  },
  {
    id: 'usde',
    symbol: 'USDe',
    apy: 11.8,
    staked: 240,
    walletKey: 'usde',
    amBase: 3.104558,
    t0: 0,
    stakeAmt: '',
    wdAmt: '',
    tab: 'annihilate',
    tagline: 'Stake USDe, accrue Antimatter.',
  },
  {
    id: 'dola',
    symbol: 'DOLA',
    apy: 9.4,
    staked: 1500,
    walletKey: 'dola',
    amBase: 1643.901244,
    t0: 0,
    stakeAmt: '',
    wdAmt: '',
    tab: 'annihilate',
    tagline: 'Stake DOLA, accrue Antimatter.',
  },
];

/**
 * The legacy phUSD → USDC pool kept at the top of the list as the contrast
 * anchor: it still pays a stablecoin rather than Antimatter, and is rendered
 * greyed out and inert.
 */
export const ANTIMATTER_LEGACY_POOL = {
  stakeSymbol: 'phUSD',
  rewardSymbol: 'USDC',
  apy: 18.4,
  staked: 640,
  pendingBase: 4.218331,
  pendingRatePerSecond: 0.00042,
} as const;

/** Per-second Antimatter accrual for a pool, with the demo multiplier applied. */
export const antimatterRate = (pool: AntimatterMockPool) =>
  (pool.staked * (pool.apy / 100) * DEMO_SPEED) / SECONDS_PER_YEAR;

/** Antimatter accrued by `pool` as of `now`, given the tab's time origin. */
export const antimatterPending = (pool: AntimatterMockPool, origin: number, now: number) => {
  const elapsed = (now - (pool.t0 || origin)) / 1000;
  return pool.amBase + elapsed * antimatterRate(pool);
};

/**
 * Freeze a pool's accrual into `amBase` and restart its clock, then apply
 * `patch`. Every mutation of `staked` must go through this — changing the
 * stake without rebasing makes the accrual curve, and so the displayed
 * counter, jump.
 */
export const antimatterRebase = (
  pool: AntimatterMockPool,
  origin: number,
  patch: Partial<AntimatterMockPool>,
): AntimatterMockPool => ({
  ...pool,
  amBase: antimatterPending(pool, origin, Date.now()),
  t0: Date.now(),
  ...patch,
});

/**
 * Split a figure into a leading portion and its last three digits, so the
 * trailing digits can be tinted and read as per-second motion. Mirrors the
 * design mock's `split(n, d)` exactly.
 */
export const antimatterSplit = (n: number, decimals: number): [string, string] => {
  const str = n.toFixed(decimals);
  const tail = Math.min(3, decimals);
  return tail > 0 ? [str.slice(0, str.length - tail), str.slice(str.length - tail)] : [str, ''];
};

/**
 * The shipped explainer. Two tones were written for the design mock; the
 * evocative one is the one on screen and the plain one is kept beside it so
 * swapping is a one-word change rather than a rewrite.
 */
export const ANTIMATTER_EXPLAINER_EVOCATIVE =
  `Matter meets antimatter: each ${ANTIMATTER_SYMBOL} pairs with one unit of your staked ` +
  'principal and both cease to exist, emitting phUSD worth the sum of the pair.';

/** The plain-spoken alternative to `ANTIMATTER_EXPLAINER_EVOCATIVE`. */
export const ANTIMATTER_EXPLAINER_PLAIN =
  `${ANTIMATTER_SYMBOL} is not claimed — it is annihilated. Every unit is matched with one unit ` +
  'of the stablecoin you have staked here; both are destroyed, and you receive phUSD equal to ' +
  'the two amounts added together. Your staked principal falls by the matched amount.';

/** Copy shown beneath the annihilate button. */
export const ANTIMATTER_IRREVERSIBLE_NOTE = (symbol: string) =>
  `Annihilation is irreversible: the matched ${symbol} leaves your stake permanently.`;
