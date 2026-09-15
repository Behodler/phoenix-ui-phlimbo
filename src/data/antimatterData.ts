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
 * own conversion and is what the annihilation preview uses. That view REVERTS
 * on an amount finer than one stable unit rather than rounding it, so the
 * amount handed to it is always floored to a multiple of `10 ** (18 - stable
 * decimals)` first — see `useStableStakerPools`.
 */
export const ANTIMATTER_DECIMALS = 18;

/**
 * What the accrual token is called everywhere on this surface.
 *
 * The word, not the ticker. `Antimatter.symbol()` returns `AM`, and the chain
 * is deliberately not consulted for the label: `AM` abbreviates nothing a user
 * meeting the tab for the first time already knows, and the entire surface —
 * the explainer, the annihilation preview, the irreversibility note — is built
 * on the matter/antimatter metaphor that the abbreviation throws away.
 */
export const ANTIMATTER_DISPLAY_NAME = 'Antimatter';

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
export const antimatterExplainerEvocative = (symbol: string, stableSymbol: string) =>
  `Each unit of ${symbol} produces two units of phUSD. E.g. 10 ${symbol} + 10 ${stableSymbol} = 20 phUSD`;

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
