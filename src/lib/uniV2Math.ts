/**
 * Uniswap V2 maths, formatting and stat-row builders for the "Market"
 * tab (stories 084, 085, 087).
 *
 * Everything that reaches a contract is bigint in on-chain units. The quote
 * builders take live chain values (reserves, LP totalSupply, the sUSDS share
 * price, helper quotes, balances, allowances) as arguments, so they are pure
 * and unit-testable; `useUniMarket` does the reading.
 *
 * Every user-facing credit — received amounts, minimum-received, LP tokens,
 * position and receive rows — is FLOORED, so display rounding never promises
 * the user more than the protocol will deliver.
 */
import { formatUnits, parseUnits } from 'viem';
import {
  LP_DECIMALS,
  LP_DP,
  LP_SYMBOL,
  MAX_PRICE_IMPACT,
  POOL_FEE,
  POOL_VENUE,
  HELPER_LABEL,
  TOKENS,
  WRAP_VENUE,
  isTarget,
  metaOf,
  methodLabel,
  type AddTokenSymbol,
  type ApprovableSymbol,
  type CounterSymbol,
  type HelperMethod,
  type MarketSymbol,
  type RemoveOutSymbol,
  type SwapTokenSymbol,
  type TargetSymbol,
  type TokenMeta,
} from '../data/uniMarketConfig';

export const WAD = 10n ** 18n;
const BPS = 10_000n;

// ---------------------------------------------------------------------------
// Input + formatting helpers
// ---------------------------------------------------------------------------

/** Sanitise a decimal text input: commas → dots, digits and a single dot only. */
export function clean(v: string): string {
  const s = String(v ?? '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const i = s.indexOf('.');
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
}

/**
 * Parse a sanitised decimal string into on-chain units. Excess fraction digits
 * are truncated (never rounded up); anything unparsable or non-positive is 0n.
 */
export function parseAmount(s: string, decimals: number): bigint {
  const c = clean(s);
  if (!c || c === '.') return 0n;
  const [int = '', frac = ''] = c.split('.');
  const norm = `${int || '0'}${frac ? `.${frac.slice(0, decimals)}` : ''}`;
  try {
    const v = parseUnits(norm, decimals);
    return v > 0n ? v : 0n;
  } catch {
    return 0n;
  }
}

/** Fixed-decimal en-US number with thousands separators (display of floats). */
export function fmt(n: number, d: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Exact FLOORED display of an on-chain amount: `dp` fraction digits, thousands
 * separators, no float rounding anywhere.
 */
export function fmtUnits(wei: bigint, decimals: number, dp: number): string {
  const neg = wei < 0n;
  const abs = neg ? -wei : wei;
  const s = formatUnits(abs, decimals);
  const [int, frac = ''] = s.split('.');
  const intStr = BigInt(int).toLocaleString('en-US');
  const body = dp > 0 ? `${intStr}.${frac.slice(0, dp).padEnd(dp, '0')}` : intStr;
  return neg ? `-${body}` : body;
}

/**
 * Input-field representation of a computed amount, floored to `dp` digits with
 * trailing zeros stripped ('' when not positive).
 */
export function rawUnits(wei: bigint, decimals: number, dp: number): string {
  if (wei <= 0n) return '';
  const s = formatUnits(wei, decimals);
  const [int, frac = ''] = s.split('.');
  const f = frac.slice(0, dp).replace(/0+$/, '');
  return f ? `${int}.${f}` : int;
}

/** Lossy float of an on-chain amount — for impact / USD / price display only. */
export function toNum(wei: bigint | undefined, decimals: number): number {
  if (wei === undefined) return 0;
  return Number(formatUnits(wei, decimals));
}

/**
 * Absolute percentage, with a "<0.01%" floor for tiny non-zero values.
 * Float noise is rounded off first so e.g. 1 − (1 − 0.0001) reads "0.01%".
 */
export function pct(x: number): string {
  const a = Math.round(Math.abs(x * 100) * 1e9) / 1e9;
  return a > 0 && a < 0.01 ? '<0.01%' : `${fmt(a, 2)}%`;
}

/** "≈ $X.XX", or '' when not positive. */
export function usd(n: number): string {
  return n > 0 ? `≈ $${fmt(n, 2)}` : '';
}

/** Compact thousands: 400000 → "400.0k". */
export function short(n: number): string {
  return n >= 1000 ? `${fmt(n / 1000, 1)}k` : fmt(n, 2);
}

export function dpOf(sym: MarketSymbol): number {
  return metaOf(sym).dp;
}

export function decimalsOf(sym: ApprovableSymbol): number {
  return sym === LP_SYMBOL ? LP_DECIMALS : metaOf(sym).decimals;
}

/** Balance text as shown in the boxes and picker (6-dp tokens show 4, others 2), floored. */
export function balText(sym: MarketSymbol, bal: bigint | undefined): string {
  const m = metaOf(sym);
  return fmtUnits(bal ?? 0n, m.decimals, m.dp === 6 ? 4 : 2);
}

// ---------------------------------------------------------------------------
// Slippage
// ---------------------------------------------------------------------------

/** Slippage percent (0.5 = 0.5%) → basis points. */
export function slipBps(slip: number): bigint {
  return BigInt(Math.round(slip * 100));
}

/** `amount × (1 − slip)`, floored in the protocol's favour. Used for every min-out. */
export function minOut(amount: bigint, slip: number): bigint {
  const bps = slipBps(slip);
  if (amount <= 0n) return 0n;
  return (amount * (BPS - (bps > BPS ? BPS : bps))) / BPS;
}

// ---------------------------------------------------------------------------
// Uniswap V2 core (bigint, identical to UniswapV2Library)
// ---------------------------------------------------------------------------

/** Output for exact input with the 0.3% fee (floored, as on-chain). */
export function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const inWithFee = amountIn * 997n;
  return (inWithFee * reserveOut) / (reserveIn * 1000n + inWithFee);
}

/** Input required for an exact output; null when it would drain the reserve. */
export function getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint): bigint | null {
  if (amountOut <= 0n) return 0n;
  if (reserveIn <= 0n || reserveOut <= 0n || amountOut >= reserveOut) return null;
  return (reserveIn * amountOut * 1000n) / ((reserveOut - amountOut) * 997n) + 1n;
}

export function ceilDiv(a: bigint, b: bigint): bigint {
  return b === 0n ? 0n : (a + b - 1n) / b;
}

/**
 * Live pair + sUSDS state every quote is built against.
 *
 * The `ph` naming predates Antimatter: on the AM/sUSDS pair `rPh` is the AM
 * reserve. Every `ph*` field in this module means "the pair's target token"
 * (phUSD or AM), as UniswapHelper's own `phusdIn` / `phusdOut` event fields do.
 */
export interface PoolState {
  /** Target-token reserve of the pair (phUSD, or AM on the AM/sUSDS pair). */
  rPh: bigint;
  /** sUSDS reserve of the pair. */
  rS: bigint;
  /** LP totalSupply. */
  totalSupply: bigint;
  /** USDS per 1e18 sUSDS (`convertToAssets(1e18)`). */
  spx: bigint;
}

export function hasLiquidity(p: PoolState | undefined): p is PoolState {
  return !!p && p.rPh > 0n && p.rS > 0n && p.totalSupply > 0n;
}

/** sUSDS → USD (USDS counted at $1). */
export function spxNum(p: PoolState | undefined): number {
  return p ? toNum(p.spx, 18) : 0;
}

/** Target-token USD price implied by the pair reserves: (rS / rPh) × spx. */
export function phPrice(rS: number, rPh: number, spx: number): number {
  return rPh > 0 ? (rS / rPh) * spx : 0;
}

export function poolPrice(p: PoolState | undefined): number {
  return p ? phPrice(toNum(p.rS, 18), toNum(p.rPh, 18), spxNum(p)) : 0;
}

/**
 * USD value of one unit of a market token. `pools` holds the pair of every
 * target in play; ETH has no oracle, so pass the quote-derived figure.
 */
export function unitUsd(
  sym: MarketSymbol,
  pools: Partial<Record<TargetSymbol, PoolState>>,
  ethUsd: number,
): number {
  if (isTarget(sym)) return poolPrice(pools[sym]);
  if (sym === 'sUSDS') return spxNum(pools.phUSD ?? pools.AM);
  if (sym === 'ETH') return ethUsd;
  return 1;
}

/** Price impact of a buy on the V2 leg: 1 − phOut / (sIn · 0.997 · rPh/rS). */
export function buyImpact(phOut: number, sIn: number, rS: number, rPh: number): number {
  const ideal = (sIn * 0.997 * rPh) / rS;
  return ideal > 0 ? Math.max(0, 1 - phOut / ideal) : 0;
}

/** Price impact of a sell on the V2 leg: 1 − sOut / (phIn · 0.997 · rS/rPh). */
export function sellImpact(sOut: number, phIn: number, rS: number, rPh: number): number {
  const ideal = (phIn * 0.997 * rS) / rPh;
  return ideal > 0 ? Math.max(0, 1 - sOut / ideal) : 0;
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export type StatTone = 'default' | 'warn' | 'danger' | 'approve';

export interface Stat {
  label: string;
  value: string;
  tone: StatTone;
}

export type Direction = 'buy' | 'sell';

export function impactTone(x: number): StatTone {
  return x > 0.03 ? 'danger' : x > 0.01 ? 'warn' : 'default';
}

/** True when an allowance read is missing or below the amount. */
export function needsApproval(allowance: bigint | undefined, amount: bigint): boolean {
  if (amount <= 0n) return false;
  return allowance === undefined || allowance < amount;
}

export interface SwapInput {
  /** Token bought (`buy`) or sold (`sell`); defaults to phUSD. */
  target?: TargetSymbol;
  /** The other side: a routed token, or the other target for phUSD ↔ AM. */
  tok: CounterSymbol;
  dir: Direction;
  /** Exact input amount in the input token's units. */
  inWei: bigint;
  /** UniswapHelper quote for `inWei` (exact-in only). */
  quoteOut: bigint | undefined;
  quoteLoading: boolean;
  quoteError: boolean;
  /** Slippage tolerance in percent (0.5 = 0.5%). */
  slip: number;
  /** The target's pair. */
  pool: PoolState | undefined;
  /** The counter's pair, needed only when the counter is the other target. */
  counterPool?: PoolState | undefined;
  inBal: bigint | undefined;
  /** Input-token allowance to UniswapHelper (ignored for native ETH in). */
  allowance: bigint | undefined;
  /** USD per ETH, derived from quoteETHToPhUSD(1e18) × phUSD price (0 = unknown). */
  ethUsd: number;
}

export interface SwapQuote {
  /** Counter-token metadata. */
  token: TokenMeta;
  target: TargetSymbol;
  buy: boolean;
  /** phUSD ↔ AM: one Router02 path across both pairs. */
  cross: boolean;
  direct: boolean;
  inSym: MarketSymbol;
  outSym: MarketSymbol;
  inWei: bigint;
  outWei: bigint;
  /** Floored `outWei × (1 − slip)`, passed as the helper's min-out. */
  minOutWei: bigint;
  inA: number;
  outA: number;
  valid: boolean;
  quoting: boolean;
  noLiq: boolean;
  impact: number;
  priceBefore: number;
  priceAfter: number;
  insufficient: boolean;
  nativeIn: boolean;
  needApprove: boolean;
  approveSym: MarketSymbol;
  method: HelperMethod;
  inUsd: number;
  outUsd: number;
  /** Ordered route symbols, input first. */
  syms: MarketSymbol[];
  /** Venue label for each arrow (syms.length − 1 entries). */
  venues: string[];
  stats: Stat[];
}

/** How a target token is spelled inside UniswapHelper function names. */
const METHOD_NAME: Record<TargetSymbol, string> = { phUSD: 'PhUSD', AM: 'AM' };

/** The UniswapHelper swap for counter `t` and `target`, in the given direction. */
export function swapMethod(t: TokenMeta, buy: boolean, target: TargetSymbol = 'phUSD'): HelperMethod {
  const T = METHOD_NAME[target];
  if (isTarget(t.sym)) {
    const C = METHOD_NAME[t.sym];
    return (buy ? `swap${C}To${T}` : `swap${T}To${C}`) as HelperMethod;
  }
  if (buy) return (t.native ? `swapETHTo${T}` : `swapTo${T}`) as HelperMethod;
  return (t.native ? `swap${T}ToETH` : `swapFrom${T}`) as HelperMethod;
}

export function swapQuote(s: SwapInput): SwapQuote {
  const target = s.target ?? 'phUSD';
  const t = metaOf(s.tok);
  const cross = isTarget(t.sym);
  const buy = s.dir === 'buy';
  const direct = !cross && t.hops.length === 0;
  const inSym: MarketSymbol = buy ? t.sym : target;
  const outSym: MarketSymbol = buy ? target : t.sym;
  const inDec = metaOf(inSym).decimals;
  const outDec = metaOf(outSym).decimals;
  const pool = s.pool;
  const cPool = s.counterPool;
  const live = hasLiquidity(pool) && (!cross || hasLiquidity(cPool));

  const inWei = s.inWei;
  const quoting = inWei > 0n && s.quoteLoading && s.quoteOut === undefined;
  const outWei = inWei > 0n && !s.quoteError ? s.quoteOut ?? 0n : 0n;
  const minOutWei = minOut(outWei, s.slip);
  const inA = toNum(inWei, inDec);
  const outA = toNum(outWei, outDec);

  let noLiq = inWei > 0n && !quoting && (s.quoteError || !live);
  const priceBefore = poolPrice(pool);
  let priceAfter = priceBefore;
  let impact = 0;
  if (live && inWei > 0n && outWei > 0n) {
    const rS = toNum(pool.rS, 18);
    const rPh = toNum(pool.rPh, 18);
    const spx = spxNum(pool);
    if (cross && cPool) {
      // Two V2 legs through sUSDS: the counter's pair first on a buy, the target's first on a sell.
      const cS = toNum(cPool.rS, 18);
      const cT = toNum(cPool.rPh, 18);
      const ideal = buy
        ? inA * 0.997 * (cS / cT) * 0.997 * (rPh / rS)
        : inA * 0.997 * (rS / rPh) * 0.997 * (cT / cS);
      impact = ideal > 0 ? Math.max(0, 1 - outA / ideal) : 0;
      if (buy) {
        const sMid = toNum(getAmountOut(inWei, cPool.rPh, cPool.rS), 18);
        priceAfter = phPrice(rS + sMid, rPh - outA, spx);
      } else {
        const sMid = toNum(getAmountOut(inWei, pool.rPh, pool.rS), 18);
        priceAfter = phPrice(rS - sMid, rPh + inA, spx);
      }
    } else if (buy) {
      const sIn = getAmountIn(outWei, pool.rS, pool.rPh);
      if (sIn === null) {
        noLiq = true;
      } else {
        const sInN = toNum(sIn, 18);
        impact = buyImpact(outA, sInN, rS, rPh);
        priceAfter = phPrice(rS + sInN, rPh - outA, spx);
      }
    } else {
      const sOut = toNum(getAmountOut(inWei, pool.rPh, pool.rS), 18);
      impact = sellImpact(sOut, inA, rS, rPh);
      priceAfter = phPrice(rS - sOut, rPh + inA, spx);
    }
  }
  const valid = inWei > 0n && outWei > 0n && !noLiq && !quoting;
  const rate = valid ? (buy ? inA / outA : outA / inA) : 0;

  const nativeIn = buy && t.native;
  const approveSym = inSym;
  const needApprove = !nativeIn && needsApproval(s.allowance, inWei);
  const method = swapMethod(t, buy, target);

  const pools: Partial<Record<TargetSymbol, PoolState>> = { [target]: pool };
  if (cross) pools[t.sym as TargetSymbol] = cPool;
  const outUsd = outA * unitUsd(outSym, pools, s.ethUsd);
  // No ETH oracle on Anvil: an ETH buy is valued at what it buys.
  const inUsd = nativeIn ? outUsd : inA * unitUsd(inSym, pools, s.ethUsd);

  let syms: MarketSymbol[];
  let venues: string[];
  if (cross) {
    syms = [inSym, 'sUSDS', outSym];
    venues = [POOL_VENUE, POOL_VENUE];
  } else {
    syms = [t.sym, ...t.hops.map((h) => h.to), target];
    venues = [...t.hops.map((h) => h.venue), POOL_VENUE];
    if (!buy) {
      syms = [...syms].reverse();
      venues = [POOL_VENUE, ...[...t.hops].reverse().map((h) => h.venueRev)];
    }
  }

  const stats: Stat[] = [];
  if (valid) {
    stats.push({ label: 'Rate', value: `1 ${target} = ${fmt(rate, t.native ? 8 : 4)} ${t.sym}`, tone: 'default' });
    stats.push({ label: 'Price impact', value: pct(impact), tone: impactTone(impact) });
    stats.push({ label: `${target} price after trade`, value: `$${fmt(priceBefore, 4)} → $${fmt(priceAfter, 4)}`, tone: 'default' });
    stats.push({
      label: `Minimum received (${s.slip}% slippage)`,
      value: `${fmtUnits(minOutWei, outDec, dpOf(outSym))} ${outSym}`,
      tone: 'default',
    });
    if (cross) {
      stats.push({ label: 'Fees (0.30% × 2 pools)', value: usd(inUsd * POOL_FEE * 2) || '≈ $0.00', tone: 'default' });
    } else {
      const feeUsd = usd(inUsd * POOL_FEE) || '≈ $0.00';
      stats.push({
        label: 'Fees (0.30% pool)',
        value: direct ? feeUsd : `${feeUsd} · venue fees included in quote`,
        tone: 'default',
      });
    }
    stats.push({
      label: 'Allowance',
      value: nativeIn ? 'Not needed (native ETH)' : needApprove ? `Approve ${approveSym} first` : `${approveSym} approved`,
      tone: needApprove ? 'approve' : 'default',
    });
  }

  return {
    token: t, target, buy, cross, direct, inSym, outSym, inWei, outWei, minOutWei, inA, outA, valid, quoting, noLiq,
    impact, priceBefore, priceAfter,
    insufficient: s.inBal !== undefined ? inWei > s.inBal : false,
    nativeIn, needApprove, approveSym, method, inUsd, outUsd, syms, venues, stats,
  };
}

export type AddEditedSide = 'tok' | 'ph';

export interface AddInput {
  /** Pair being supplied (defaults to phUSD/sUSDS); the `ph*` fields carry this token. */
  target?: TargetSymbol;
  depositSym: AddTokenSymbol;
  edited: AddEditedSide;
  /** Typed deposit-token amount (used when edited === 'tok'). */
  tokWei: bigint;
  /** Typed target-token amount (used when edited === 'ph'). */
  phWei: bigint;
  /** `sUSDS.previewDeposit(tokWei)` for the USDS path, when read. */
  previewShares: bigint | undefined;
  slip: number;
  pool: PoolState | undefined;
  tokBal: bigint | undefined;
  phBal: bigint | undefined;
  tokAllowance: bigint | undefined;
  phAllowance: bigint | undefined;
}

export interface AddQuote {
  target: TargetSymbol;
  depositSym: AddTokenSymbol;
  /** Deposit-token amount (USDS or sUSDS) desired. */
  a: bigint;
  /** sUSDS that reaches the pair (equals `a` on the sUSDS path). */
  s: bigint;
  /** Target-token (phUSD or AM) amount desired. */
  b: bigint;
  aMin: bigint;
  bMin: bigint;
  valid: boolean;
  noLiq: boolean;
  price: number;
  /** Estimated LP minted (floored). */
  lp: bigint;
  share: number;
  /** '' when balances suffice, else the symbol that is short. */
  insufficient: '' | AddTokenSymbol | TargetSymbol;
  needTok: boolean;
  needPh: boolean;
  method: HelperMethod;
  aUsd: number;
  bUsd: number;
  stats: Stat[];
}

/** LP minted for a two-sided add: min(s·TS/rS, ph·TS/rPh), floored. */
export function lpForDeposit(s: bigint, ph: bigint, p: PoolState): bigint {
  if (!hasLiquidity(p)) return 0n;
  const a = (s * p.totalSupply) / p.rS;
  const b = (ph * p.totalSupply) / p.rPh;
  return a < b ? a : b;
}

export function addQuote(s: AddInput): AddQuote {
  const T = s.target ?? 'phUSD';
  const pool = s.pool;
  const live = hasLiquidity(pool);
  const viaUsds = s.depositSym === 'USDS';
  const price = poolPrice(pool);
  const spx = spxNum(pool);

  let a = 0n;
  let sAmt = 0n;
  let b = 0n;
  if (live) {
    if (s.edited === 'tok') {
      a = s.tokWei;
      sAmt = viaUsds ? s.previewShares ?? (pool.spx > 0n ? (a * WAD) / pool.spx : 0n) : a;
      b = (sAmt * pool.rPh) / pool.rS;
    } else {
      b = s.phWei;
      sAmt = (b * pool.rS) / pool.rPh;
      a = viaUsds ? ceilDiv(sAmt * pool.spx, WAD) : sAmt;
    }
  }

  const typed = s.edited === 'tok' ? s.tokWei : s.phWei;
  const noLiq = typed > 0n && !live;
  const valid = live && a > 0n && b > 0n;
  const lp = valid ? lpForDeposit(sAmt, b, pool) : 0n;
  const lpN = toNum(lp, LP_DECIMALS);
  const tsN = live ? toNum(pool.totalSupply, LP_DECIMALS) : 0;
  const share = valid && tsN + lpN > 0 ? lpN / (tsN + lpN) : 0;
  const aMin = minOut(a, s.slip);
  const bMin = minOut(b, s.slip);
  const aUsd = toNum(a, 18) * (viaUsds ? 1 : spx);
  const bUsd = toNum(b, 18) * price;
  const dpA = TOKENS[s.depositSym].dp;

  const stats: Stat[] = [];
  if (valid) {
    stats.push({ label: 'Pool price', value: `1 ${T} = ${fmt(toNum(pool.rS, 18) / toNum(pool.rPh, 18), 4)} sUSDS ($${fmt(price, 4)})`, tone: 'default' });
    stats.push({ label: 'sUSDS price', value: `1 sUSDS = $${fmt(spx, 4)} (accrues savings rate)`, tone: 'default' });
    stats.push({ label: 'Deposited (up to)', value: `${fmtUnits(a, 18, dpA)} ${s.depositSym} + ${fmtUnits(b, 18, 2)} ${T}`, tone: 'default' });
    if (viaUsds) {
      stats.push({ label: 'Wrapped to sUSDS', value: `${fmtUnits(sAmt, 18, 4)} sUSDS via ${WRAP_VENUE}`, tone: 'default' });
    }
    stats.push({ label: 'LP tokens received', value: `${fmtUnits(lp, LP_DECIMALS, LP_DP)} ${LP_SYMBOL}`, tone: 'default' });
    stats.push({ label: 'Share of pool', value: pct(share), tone: 'default' });
    stats.push({
      label: `Min. deposited (${s.slip}% slippage)`,
      value: `${fmtUnits(aMin, 18, dpA)} ${s.depositSym} + ${fmtUnits(bMin, 18, 2)} ${T}`,
      tone: 'default',
    });
    stats.push({ label: 'Deposit value', value: usd(aUsd + bUsd), tone: 'default' });
  }

  return {
    target: T, depositSym: s.depositSym, a, s: sAmt, b, aMin, bMin, valid, noLiq, price, lp, share,
    insufficient: s.tokBal !== undefined && a > s.tokBal
      ? s.depositSym
      : s.phBal !== undefined && b > s.phBal ? T : '',
    needTok: needsApproval(s.tokAllowance, a),
    needPh: needsApproval(s.phAllowance, b),
    method: T === 'AM'
      ? (viaUsds ? 'addLiquidityAMUSDS' : 'addLiquidityAMSUSDS')
      : (viaUsds ? 'addLiquidityUSDS' : 'addLiquiditySUSDS'),
    aUsd, bUsd, stats,
  };
}

// ---------------------------------------------------------------------------
// LP position + remove liquidity
// ---------------------------------------------------------------------------

export interface PositionView {
  /** UNI-V2 held. */
  lp: bigint;
  /** Fraction of the pool (lp / totalSupply). */
  share: number;
  /** Underlying sUSDS (floored). */
  s: bigint;
  /** Underlying target token, phUSD or AM (floored). */
  ph: bigint;
  /** USD value of the underlying. */
  value: number;
}

/** Underlying amounts and value of an LP balance, against the real totalSupply. */
export function positionView(lp: bigint, p: PoolState | undefined): PositionView {
  if (!hasLiquidity(p) || lp <= 0n) return { lp: lp > 0n ? lp : 0n, share: 0, s: 0n, ph: 0n, value: 0 };
  const s = (lp * p.rS) / p.totalSupply;
  const ph = (lp * p.rPh) / p.totalSupply;
  return {
    lp,
    share: toNum(lp, LP_DECIMALS) / toNum(p.totalSupply, LP_DECIMALS),
    s,
    ph,
    value: toNum(s, 18) * spxNum(p) + toNum(ph, 18) * poolPrice(p),
  };
}

export interface RemoveInput {
  /** Pair being burned (defaults to phUSD/sUSDS); `phAmt` / `phMin` carry this token. */
  target?: TargetSymbol;
  /** LP to burn. */
  burnWei: bigint;
  /** Current LP balance. */
  lpBal: bigint;
  out: RemoveOutSymbol;
  /** `sUSDS.previewRedeem(sAmt)` for the USDS path, when read. */
  previewUsds: bigint | undefined;
  slip: number;
  pool: PoolState | undefined;
  /** LP (pair) allowance to UniswapHelper. */
  allowance: bigint | undefined;
}

export interface RemoveQuote {
  target: TargetSymbol;
  burn: bigint;
  lp: bigint;
  /** True when the sUSDS side is paid out as USDS. */
  usds: boolean;
  valid: boolean;
  /** Burn exceeds the LP balance. */
  over: boolean;
  needApprove: boolean;
  method: HelperMethod;
  /** sUSDS share of the burn, before any redemption (floored). */
  sAmt: bigint;
  phAmt: bigint;
  outSym: RemoveOutSymbol;
  /** Amount of `outSym` received (floored). */
  outAmt: bigint;
  outMin: bigint;
  phMin: bigint;
  outDp: number;
  value: number;
  stats: Stat[];
}

/** sUSDS share-count → USDS by the share price (floored); fallback for previewRedeem. */
function sharesToUsds(shares: bigint, p: PoolState): bigint {
  return (shares * p.spx) / WAD;
}

export function removeQuote(s: RemoveInput): RemoveQuote {
  const T = s.target ?? 'phUSD';
  const pool = s.pool;
  const live = hasLiquidity(pool);
  const usds = s.out === 'USDS';
  const burn = s.burnWei;
  const valid = live && burn > 0n;
  const over = burn > s.lpBal;
  const sAmt = live ? (burn * pool.rS) / pool.totalSupply : 0n;
  const phAmt = live ? (burn * pool.rPh) / pool.totalSupply : 0n;
  const outSym: RemoveOutSymbol = usds ? 'USDS' : 'sUSDS';
  const outAmt = usds ? (live ? s.previewUsds ?? sharesToUsds(sAmt, pool) : 0n) : sAmt;
  const outDp = usds ? 2 : 4;
  const outMin = minOut(outAmt, s.slip);
  const phMin = minOut(phAmt, s.slip);
  const price = poolPrice(pool);
  const value = toNum(sAmt, 18) * spxNum(pool) + toNum(phAmt, 18) * price;
  const needApprove = needsApproval(s.allowance, burn);

  const stats: Stat[] = [];
  if (valid) {
    const left = s.lpBal > burn ? s.lpBal - burn : 0n;
    const ts = toNum(pool.totalSupply, LP_DECIMALS);
    stats.push({ label: 'Pool price', value: `1 ${T} = ${fmt(toNum(pool.rS, 18) / toNum(pool.rPh, 18), 4)} sUSDS ($${fmt(price, 4)})`, tone: 'default' });
    stats.push({
      label: 'LP tokens burned',
      value: `${fmtUnits(burn, LP_DECIMALS, LP_DP)} ${LP_SYMBOL} (${pct(s.lpBal > 0n ? toNum(burn, 18) / toNum(s.lpBal, 18) : 0)} of position)`,
      tone: 'default',
    });
    if (usds) stats.push({ label: 'sUSDS redeemed to USDS', value: `${fmtUnits(sAmt, 18, 4)} sUSDS × ${fmt(spxNum(pool), 4)}`, tone: 'default' });
    stats.push({
      label: `Min. received (${s.slip}% slippage)`,
      value: `${fmtUnits(outMin, 18, outDp)} ${outSym} + ${fmtUnits(phMin, 18, 2)} ${T}`,
      tone: 'default',
    });
    stats.push({ label: 'Remaining position', value: `${fmtUnits(left, LP_DECIMALS, LP_DP)} ${LP_SYMBOL} · ${pct(ts > 0 ? toNum(left, 18) / ts : 0)} of pool`, tone: 'default' });
    stats.push({ label: 'Withdrawal value', value: usd(value), tone: 'default' });
    stats.push({
      label: 'Allowance',
      value: needApprove ? `Approve ${LP_SYMBOL} first` : `${LP_SYMBOL} approved`,
      tone: needApprove ? 'approve' : 'default',
    });
  }

  return {
    target: T, burn, lp: s.lpBal, usds, valid, over, needApprove,
    method: T === 'AM'
      ? (usds ? 'removeLiquidityAMUSDS' : 'removeLiquidityAMSUSDS')
      : (usds ? 'removeLiquidityUSDS' : 'removeLiquiditySUSDS'),
    sAmt, phAmt, outSym, outAmt, outMin, phMin, outDp, value, stats,
  };
}

/** Burn amount for a quick-pick fraction of the position (Max = the exact balance). */
export function removePctAmount(lp: bigint, p: number): bigint {
  if (p >= 1) return lp;
  return (lp * BigInt(Math.round(p * 10_000))) / BPS;
}

/** A quick-pick chip is selected when the burn equals that fraction of a non-empty position. */
export function removePctSelected(lp: bigint, burn: bigint, p: number): boolean {
  return lp > 0n && burn > 0n && burn === removePctAmount(lp, p);
}

/** "25%" … "75%", or "Max" for the whole position. */
export function removePctLabel(p: number): string {
  return p === 1 ? 'Max' : `${p * 100}%`;
}

/** Stats labels the review modal drops from the remove-liquidity list. */
const REMOVE_MODAL_HIDDEN = new Set(['Pool price', 'Allowance']);

export function removeModalStats(q: RemoveQuote): Stat[] {
  return q.stats.filter((x) => !REMOVE_MODAL_HIDDEN.has(x.label));
}

/** Stats labels the review modal drops from the add-liquidity list. */
const ADD_MODAL_HIDDEN = new Set(['Pool price', 'sUSDS price', 'Deposit value']);

export function swapModalStats(q: SwapQuote): Stat[] {
  return [
    ...q.stats.filter((x) => x.label !== 'Allowance'),
    { label: 'Route', value: q.syms.join(' → '), tone: 'default' },
  ];
}

export function addModalStats(q: AddQuote): Stat[] {
  return q.stats.filter((x) => !ADD_MODAL_HIDDEN.has(x.label));
}

// ---------------------------------------------------------------------------
// Review steps + CTA
// ---------------------------------------------------------------------------

export interface ReviewStep {
  kind: 'approve' | 'action';
  /** Token being approved (approve steps only) — a market token or UNI-V2. */
  sym?: ApprovableSymbol;
  /** Amount the approve step needs (approve steps only). */
  amount?: bigint;
  label: string;
  /** Contract call shown under the label. */
  sub: string;
}

export function approveStep(sym: ApprovableSymbol, amount: bigint): ReviewStep {
  return { kind: 'approve', sym, amount, label: `Approve ${sym}`, sub: `${sym}.approve(${HELPER_LABEL})` };
}

export function swapSteps(q: SwapQuote): ReviewStep[] {
  const steps: ReviewStep[] = [];
  if (q.needApprove) steps.push(approveStep(q.approveSym, q.inWei));
  steps.push({
    kind: 'action',
    label: `Swap ${q.inSym} for ${q.outSym}${q.direct ? '' : ` (${q.syms.length - 1} hops)`}`,
    sub: methodLabel(q.method),
  });
  return steps;
}

export function addSteps(q: AddQuote): ReviewStep[] {
  const steps: ReviewStep[] = [];
  if (q.needTok) steps.push(approveStep(q.depositSym, q.a));
  if (q.needPh) steps.push(approveStep(q.target, q.b));
  steps.push({
    kind: 'action',
    label: q.depositSym === 'USDS' ? `Supply USDS + ${q.target} (wraps to sUSDS)` : `Supply sUSDS + ${q.target}`,
    sub: methodLabel(q.method),
  });
  return steps;
}

export function removeSteps(q: RemoveQuote): ReviewStep[] {
  const steps: ReviewStep[] = [];
  if (q.needApprove) steps.push(approveStep(LP_SYMBOL, q.burn));
  steps.push({
    kind: 'action',
    label: q.usds ? 'Remove liquidity & redeem sUSDS → USDS' : 'Remove liquidity',
    sub: methodLabel(q.method),
  });
  return steps;
}

export interface Cta {
  label: string;
  enabled: boolean;
}

export const UNAVAILABLE_CTA: Cta = { label: 'Not available on this network', enabled: false };

export function swapCta(q: SwapQuote, connected: boolean): Cta {
  if (q.inWei <= 0n) return { label: 'Enter an amount', enabled: false };
  if (q.quoting) return { label: 'Fetching quote…', enabled: false };
  if (q.noLiq) return { label: 'Insufficient liquidity', enabled: false };
  if (!q.valid) return { label: 'Enter an amount', enabled: false };
  if (!connected) return { label: 'Connect wallet', enabled: false };
  if (q.insufficient) return { label: `Insufficient ${q.inSym} balance`, enabled: false };
  if (q.impact > MAX_PRICE_IMPACT) return { label: 'Price impact too high', enabled: false };
  return { label: 'Review swap', enabled: true };
}

export function addCta(q: AddQuote, connected: boolean): Cta {
  if (q.noLiq) return { label: 'Insufficient liquidity', enabled: false };
  if (!q.valid) return { label: 'Enter an amount', enabled: false };
  if (!connected) return { label: 'Connect wallet', enabled: false };
  if (q.insufficient) return { label: `Insufficient ${q.insufficient} balance`, enabled: false };
  return { label: 'Review supply', enabled: true };
}

export function removeCta(q: RemoveQuote, connected: boolean): Cta {
  if (!connected) return { label: 'Connect wallet', enabled: false };
  if (q.lp <= 0n) return { label: 'No liquidity to remove', enabled: false };
  if (!q.valid) return { label: 'Enter an amount', enabled: false };
  if (q.over) return { label: `Insufficient ${LP_SYMBOL} balance`, enabled: false };
  return { label: 'Review removal', enabled: true };
}

/** "Direct · 1 hop" or "N hops · 1 transaction". */
export function routeSummary(syms: readonly MarketSymbol[]): string {
  const hops = syms.length - 1;
  return hops === 1 ? 'Direct · 1 hop' : `${hops} hops · 1 transaction`;
}

/** "via USDC → USDS → sUSDS" hint for the picker, or "direct pair". */
export function routeHint(sym: SwapTokenSymbol): string {
  const hops = TOKENS[sym].hops;
  return hops.length ? `via ${hops.map((h) => h.to).join(' → ')}` : 'direct pair';
}
