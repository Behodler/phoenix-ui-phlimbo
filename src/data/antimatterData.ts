/**
 * Static presentation config for the **Antimatter leg of the Stake tab**.
 *
 * STATIC CONFIG ONLY — accent colours, copy, sub-tab identifiers and the
 * accrual token's decimals. Every *number the user sees* (staked balance,
 * accrued Antimatter, rate per second, wallet balances, the annihilation
 * preview) is read live from `StableStakerV2` / `Antimatter` by
 * `useStableStakerPools`. There is no simulated state here: the `setInterval`,
 * the `DEMO_SPEED` multiplier and the wallet/pool literals that story 079's
 * design preview ran on were deleted when story 082 wired the surface to
 * contracts.
 *
 * Mirrors the shape of `src/data/stableStakerPools.ts`, which owns the pool
 * list and the address keys.
 */

/**
 * Antimatter is an 18-decimal ERC20. Named here so the reward-token scaling
 * never appears as a bare `1e18` beside the 6-decimal stake tokens.
 *
 * Converting an Antimatter amount into stake-token units is NOT done with this
 * constant: `antimatterAbi.toStableAmount(stable, amount)` is the contract's
 * own conversion and is what the annihilation preview uses.
 */
export const ANTIMATTER_DECIMALS = 18;

/**
 * Ticker shown before `Antimatter.symbol()` has resolved, or when the contract
 * is not deployed on the current network. The real symbol is always read from
 * the chain.
 */
export const ANTIMATTER_FALLBACK_SYMBOL = 'AM';

/** Lavender accent applied to the trailing digits of Antimatter figures. */
export const ANTIMATTER_ACCENT = 'rgba(196,174,234,.95)';

/** Yellow accent applied to the trailing digits of the phUSD payout figure. */
export const PHUSD_ACCENT = 'rgba(255,217,61,.92)';

/** Solid orange used for phUSD values on the right of a before/after arrow. */
export const PHUSD_ARROW_ACCENT = '#FFB566';

/** Which form the expanded panel of a pool row is showing. */
export type AntimatterSubTab = 'stake' | 'withdraw' | 'annihilate';

/**
 * The shipped explainer. Two tones were written when the surface was designed;
 * the evocative one is the one on screen and the plain one is kept beside it so
 * swapping is a one-word change rather than a rewrite.
 */
export const antimatterExplainerEvocative = (symbol: string) =>
  `Matter meets antimatter: each ${symbol} pairs with one unit of your staked ` +
  'principal and both cease to exist, emitting phUSD worth the sum of the pair.';

/** The plain-spoken alternative to `antimatterExplainerEvocative`. */
export const antimatterExplainerPlain = (symbol: string) =>
  `${symbol} is not claimed — it is annihilated. Every unit is matched with one unit ` +
  'of the stablecoin you have staked here; both are destroyed, and you receive phUSD equal to ' +
  'the two amounts added together. Your staked principal falls by the matched amount.';

/** Copy shown beneath the annihilate button. */
export const ANTIMATTER_IRREVERSIBLE_NOTE = (symbol: string) =>
  `Annihilation is irreversible: the matched ${symbol} leaves your stake permanently.`;

/**
 * Split a figure into a leading portion and its last three digits, so the
 * trailing digits can be tinted and read as per-second motion.
 */
export const antimatterSplit = (n: number, decimals: number): [string, string] => {
  const str = n.toFixed(decimals);
  const tail = Math.min(3, decimals);
  return tail > 0 ? [str.slice(0, str.length - tail), str.slice(str.length - tail)] : [str, ''];
};
