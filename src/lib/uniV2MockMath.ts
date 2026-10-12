/**
 * Pure Uniswap V2 maths + formatting for the mocked "Market (uni)" tab
 * (stories 084, 085). A faithful port of `swapCalc` / `addCalc` (V1 mockup)
 * and `posCalc` / `rmCalc` (V2 mockup) from the design mockups' script blocks.
 *
 * Display-only floats — no bigint, no wei. When the live-wiring story arrives
 * these quotes will be redone in on-chain units against real reserves.
 */
import {
  LP_SYMBOL,
  MAX_PRICE_IMPACT,
  METHODS,
  PH_BAL,
  POOL,
  POOL_FEE,
  POOL_VENUE,
  SPENDERS,
  SPX,
  TOKENS,
  WRAP_VENUE,
  approvalKey,
  type AddTokenSymbol,
  type ApprovableSymbol,
  type MarketSymbol,
  type MockToken,
  type RemoveOutSymbol,
  type RouteHop,
  type SpenderKey,
  type SwapTokenSymbol,
} from '../data/uniMarketMockData';

// ---------------------------------------------------------------------------
// Input + formatting helpers
// ---------------------------------------------------------------------------

/** Parse a sanitised input string; anything non-positive or non-finite is 0. */
export function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sanitise a decimal text input: commas → dots, digits and a single dot only. */
export function clean(v: string): string {
  const s = String(v ?? '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const i = s.indexOf('.');
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
}

/** Fixed-decimal en-US number with thousands separators. */
export function fmt(n: number, d: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Raw input-field representation of a computed amount ('' when not positive/finite). */
export function raw(n: number, d: number): string {
  return n > 0 && Number.isFinite(n) ? String(parseFloat(n.toFixed(d))) : '';
}

/**
 * Absolute percentage, with a "<0.01%" floor for tiny non-zero values.
 * Float noise is rounded off first so e.g. 1 − (1 − 0.0001) reads "0.01%",
 * not "<0.01%" (the mockup's version had that artefact).
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
  return sym === 'phUSD' ? 2 : TOKENS[sym].dp;
}

export function balanceOf(sym: MarketSymbol): number {
  return sym === 'phUSD' ? PH_BAL : TOKENS[sym].bal;
}

/** Balance text as shown in the boxes and picker (ETH-like 6dp tokens show 4). */
export function balText(sym: MarketSymbol): string {
  const d = dpOf(sym);
  return fmt(balanceOf(sym), d === 6 ? 4 : 2);
}

// ---------------------------------------------------------------------------
// Uniswap V2 core
// ---------------------------------------------------------------------------

/** Output for exact input `x` with the 0.3% fee. */
export function amtOut(x: number, rI: number, rO: number): number {
  return (x * 997 * rO) / (rI * 1000 + x * 997);
}

/** Input required for exact output `y`; Infinity when `y` drains the reserve. */
export function amtIn(y: number, rI: number, rO: number): number {
  return y >= rO ? Infinity : (rI * y * 1000) / ((rO - y) * 997);
}

/** phUSD USD price implied by the pair reserves. */
export function phPrice(rS: number, rPh: number, spx: number = SPX): number {
  return (rS / rPh) * spx;
}

/** Compounded fee of the off-pool route hops: 1 − Π(1 − fee). */
export function routeFee(hops: readonly RouteHop[]): number {
  return 1 - hops.reduce((p, h) => p * (1 - h.fee), 1);
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
export type EditedSide = 'pay' | 'recv';

export interface SwapInput {
  tok: SwapTokenSymbol;
  dir: Direction;
  edited: EditedSide;
  pay: string;
  recv: string;
  /** Slippage tolerance in percent (0.5 = 0.5%). */
  slip: number;
  approvals: Readonly<Record<string, boolean>>;
}

export interface SwapQuote {
  token: MockToken;
  buy: boolean;
  direct: boolean;
  exactIn: boolean;
  inSym: MarketSymbol;
  outSym: MarketSymbol;
  inA: number;
  outA: number;
  /** sUSDS amount crossing the pair. */
  sLeg: number;
  valid: boolean;
  noLiq: boolean;
  impact: number;
  priceBefore: number;
  priceAfter: number;
  insufficient: boolean;
  needApprove: boolean;
  approveSym: MarketSymbol;
  spender: SpenderKey;
  method: string;
  inUsd: number;
  outUsd: number;
  /** Ordered route symbols, input first. */
  syms: MarketSymbol[];
  /** Venue label for each arrow (syms.length − 1 entries). */
  venues: string[];
  stats: Stat[];
}

export function impactTone(x: number): StatTone {
  return x > 0.03 ? 'danger' : x > 0.01 ? 'warn' : 'default';
}

export function swapQuote(s: SwapInput): SwapQuote {
  const t = TOKENS[s.tok];
  const buy = s.dir === 'buy';
  const f = routeFee(t.hops);
  const direct = t.hops.length === 0;
  const { rS, rPh } = POOL;
  const inSym: MarketSymbol = buy ? t.sym : 'phUSD';
  const outSym: MarketSymbol = buy ? 'phUSD' : t.sym;
  const exactIn = s.edited === 'pay';

  let inA = 0;
  let outA = 0;
  let sLeg = 0;
  if (buy) {
    if (exactIn) {
      inA = num(s.pay);
      sLeg = (inA * t.usd * (1 - f)) / SPX;
      outA = inA > 0 ? amtOut(sLeg, rS, rPh) : 0;
    } else {
      outA = num(s.recv);
      sLeg = outA > 0 ? amtIn(outA, rS, rPh) : 0;
      inA = (sLeg * SPX) / (t.usd * (1 - f));
    }
  } else if (exactIn) {
    inA = num(s.pay);
    sLeg = inA > 0 ? amtOut(inA, rPh, rS) : 0;
    outA = (sLeg * SPX * (1 - f)) / t.usd;
  } else {
    outA = num(s.recv);
    sLeg = (outA * t.usd) / (SPX * (1 - f));
    inA = outA > 0 ? amtIn(sLeg, rPh, rS) : 0;
  }

  const noLiq = !Number.isFinite(inA);
  const valid = inA > 0 && outA > 0 && !noLiq;
  const priceBefore = phPrice(rS, rPh);
  let priceAfter = priceBefore;
  let impact = 0;
  if (valid) {
    impact = buy
      ? 1 - outA / ((sLeg * 0.997 * rPh) / rS)
      : 1 - sLeg / ((inA * 0.997 * rS) / rPh);
    priceAfter = buy ? phPrice(rS + sLeg, rPh - outA) : phPrice(rS - sLeg, rPh + inA);
  }
  const rate = valid ? (buy ? inA / outA : outA / inA) : 0;
  const inBal = buy ? t.bal : PH_BAL;

  const spender: SpenderKey = direct ? 'router' : 'swapZap';
  const approveSym = inSym;
  const nativeIn = buy && t.native;
  const needApprove = !nativeIn && !s.approvals[approvalKey(approveSym, spender)];

  let method: string;
  if (direct) method = exactIn ? METHODS.routerSwapExactIn : METHODS.routerSwapExactOut;
  else if (buy) method = t.native ? METHODS.zapSwapETHToPhUSD : METHODS.zapSwapToPhUSD;
  else method = t.native ? METHODS.zapSwapPhUSDToETH : METHODS.zapSwapFromPhUSD;

  const inUsd = buy ? inA * t.usd : inA * priceBefore;
  const outUsd = buy ? outA * priceBefore : outA * t.usd;

  let syms: MarketSymbol[] = [t.sym, ...t.hops.map((h) => h.to), 'phUSD'];
  let venues: string[] = [...t.hops.map((h) => h.venue), POOL_VENUE];
  if (!buy) {
    syms = [...syms].reverse();
    venues = [POOL_VENUE, ...[...t.hops].reverse().map((h) => h.venueRev)];
  }

  const stats: Stat[] = [];
  if (valid) {
    stats.push({ label: 'Rate', value: `1 phUSD = ${fmt(rate, t.native ? 8 : 4)} ${t.sym}`, tone: 'default' });
    stats.push({ label: 'Price impact', value: pct(impact), tone: impactTone(impact) });
    stats.push({ label: 'phUSD price after trade', value: `$${fmt(priceBefore, 4)} → $${fmt(priceAfter, 4)}`, tone: 'default' });
    if (exactIn) {
      stats.push({ label: `Minimum received (${s.slip}% slippage)`, value: `${fmt(outA * (1 - s.slip / 100), dpOf(outSym))} ${outSym}`, tone: 'default' });
    } else {
      stats.push({ label: `Maximum sold (${s.slip}% slippage)`, value: `${fmt(inA * (1 + s.slip / 100), dpOf(inSym))} ${inSym}`, tone: 'default' });
    }
    const feeLabel = `Fees (0.30% pool${f > 0 ? ` + ${pct(f)} route` : ''})`;
    stats.push({ label: feeLabel, value: usd(inUsd * (POOL_FEE + f)) || '≈ $0.00', tone: 'default' });
    stats.push({
      label: 'Allowance',
      value: nativeIn ? 'Not needed (native ETH)' : needApprove ? `Approve ${approveSym} first` : `${approveSym} approved`,
      tone: needApprove ? 'approve' : 'default',
    });
  }

  return {
    token: t, buy, direct, exactIn, inSym, outSym, inA, outA, sLeg, valid, noLiq, impact,
    priceBefore, priceAfter, insufficient: inA > inBal, needApprove, approveSym, spender, method,
    inUsd, outUsd, syms, venues, stats,
  };
}

export type AddEditedSide = 'tok' | 'ph';

export interface AddInput {
  depositSym: AddTokenSymbol;
  aTok: string;
  aPh: string;
  edited: AddEditedSide;
  slip: number;
  approvals: Readonly<Record<string, boolean>>;
}

export interface AddQuote {
  depositSym: AddTokenSymbol;
  /** Amount of the chosen deposit token (USDS or sUSDS). */
  a: number;
  /** sUSDS that reaches the pair (equals `a` on the sUSDS path). */
  s: number;
  /** phUSD amount. */
  b: number;
  valid: boolean;
  price: number;
  lp: number;
  share: number;
  /** '' when balances suffice, else the symbol that is short. */
  insufficient: '' | AddTokenSymbol | 'phUSD';
  spender: SpenderKey;
  needTok: boolean;
  needPh: boolean;
  method: string;
  /** USD value of the chosen-token leg. */
  aUsd: number;
  bUsd: number;
  stats: Stat[];
}

/** USD value of one unit of an add-liquidity deposit token. */
export function addTokenUsd(sym: AddTokenSymbol): number {
  return TOKENS[sym].usd;
}

export function addQuote(s: AddInput): AddQuote {
  const { rS, rPh } = POOL;
  const TS = Math.sqrt(rS * rPh);
  const price = phPrice(rS, rPh);
  const viaZap = s.depositSym === 'USDS';
  const toS = (a: number) => (viaZap ? a / SPX : a);
  const fromS = (x: number) => (viaZap ? x * SPX : x);

  let a: number;
  let sAmt: number;
  let b: number;
  if (s.edited === 'tok') {
    a = num(s.aTok);
    sAmt = toS(a);
    b = (sAmt * rPh) / rS;
  } else {
    b = num(s.aPh);
    sAmt = (b * rS) / rPh;
    a = fromS(sAmt);
  }

  const spender: SpenderKey = viaZap ? 'zap' : 'router';
  const valid = a > 0 && b > 0;
  const lp = valid ? (sAmt * TS) / rS : 0;
  const share = valid ? lp / (TS + lp) : 0;
  const aUsd = a * addTokenUsd(s.depositSym);
  const bUsd = b * price;
  const dpA = TOKENS[s.depositSym].dp;
  const slip = s.slip / 100;

  const stats: Stat[] = [];
  if (valid) {
    stats.push({ label: 'Pool price', value: `1 phUSD = ${fmt(rS / rPh, 4)} sUSDS ($${fmt(price, 4)})`, tone: 'default' });
    stats.push({ label: 'sUSDS price', value: `1 sUSDS = $${fmt(SPX, 4)} (accrues savings rate)`, tone: 'default' });
    stats.push({ label: 'Deposited', value: `${fmt(a, dpA)} ${s.depositSym} + ${fmt(b, 2)} phUSD`, tone: 'default' });
    if (viaZap) {
      stats.push({ label: 'Wrapped to sUSDS', value: `${fmt(sAmt, 4)} sUSDS via ${WRAP_VENUE}`, tone: 'default' });
    }
    stats.push({ label: 'LP tokens received', value: `${fmt(lp, 4)} UNI-V2`, tone: 'default' });
    stats.push({ label: 'Share of pool', value: pct(share), tone: 'default' });
    stats.push({
      label: `Min. deposited (${s.slip}% slippage)`,
      value: `${fmt(a * (1 - slip), dpA)} ${s.depositSym} + ${fmt(b * (1 - slip), 2)} phUSD`,
      tone: 'default',
    });
    stats.push({ label: 'Deposit value', value: usd(aUsd + bUsd), tone: 'default' });
  }

  return {
    depositSym: s.depositSym, a, s: sAmt, b, valid, price, lp, share,
    insufficient: a > TOKENS[s.depositSym].bal ? s.depositSym : b > PH_BAL ? 'phUSD' : '',
    spender,
    needTok: !s.approvals[approvalKey(s.depositSym, spender)],
    needPh: !s.approvals[approvalKey('phUSD', spender)],
    method: viaZap ? METHODS.zapAddLiquidityWithUSDS : METHODS.routerAddLiquidity,
    aUsd, bUsd, stats,
  };
}

// ---------------------------------------------------------------------------
// LP position + remove liquidity (story 085)
// ---------------------------------------------------------------------------

/**
 * LP token supply implied by the static reserves (√(rS·rPh)). Reserves never
 * move in the mock, so this is also the denominator for position share.
 */
function lpSupply(): number {
  return Math.sqrt(POOL.rS * POOL.rPh);
}

export interface PositionView {
  /** UNI-V2 held. */
  lp: number;
  /** Fraction of the pool (lp / supply). */
  share: number;
  /** Underlying sUSDS. */
  s: number;
  /** Underlying phUSD. */
  ph: number;
  /** USD value of the underlying. */
  value: number;
}

/** Underlying amounts and value of an LP balance (mockup `posCalc`). */
export function positionView(lp: number): PositionView {
  const { rS, rPh } = POOL;
  const TS = lpSupply();
  const price = phPrice(rS, rPh);
  const s = (lp / TS) * rS;
  const ph = (lp / TS) * rPh;
  return { lp, share: lp / TS, s, ph, value: s * SPX + ph * price };
}

export interface RemoveInput {
  /** Raw burn amount (UNI-V2) from the input. */
  rLp: string;
  /** Current LP balance. */
  lp: number;
  out: RemoveOutSymbol;
  /** Slippage tolerance in percent (0.5 = 0.5%). */
  slip: number;
  approvals: Readonly<Record<string, boolean>>;
}

export interface RemoveQuote {
  /** UNI-V2 to burn. */
  burn: number;
  lp: number;
  /** True when the sUSDS side is paid out as USDS via the liquidity zap. */
  usds: boolean;
  valid: boolean;
  /** Burn exceeds the LP balance. */
  over: boolean;
  spender: SpenderKey;
  needApprove: boolean;
  method: string;
  /** sUSDS share of the burn, before any redemption. */
  sAmt: number;
  phAmt: number;
  outSym: RemoveOutSymbol;
  /** Amount of `outSym` received. */
  outAmt: number;
  outDp: number;
  value: number;
  stats: Stat[];
}

/** Remove-liquidity quote (mockup `rmCalc`). */
export function removeQuote(s: RemoveInput): RemoveQuote {
  const { rS, rPh } = POOL;
  const TS = lpSupply();
  const price = phPrice(rS, rPh);
  const usds = s.out === 'USDS';
  const burn = num(s.rLp);
  const slip = s.slip / 100;
  const valid = burn > 0;
  const over = burn > s.lp + 1e-9;
  // USDS out goes through the liquidity zap (same contract and UNI-V2
  // allowance target as zap.addLiquidityWithUSDS); sUSDS out uses the router.
  const spender: SpenderKey = usds ? 'zap' : 'router';
  const needApprove = !s.approvals[approvalKey(LP_SYMBOL, spender)];
  const sAmt = (burn / TS) * rS;
  const phAmt = (burn / TS) * rPh;
  const outSym: RemoveOutSymbol = usds ? 'USDS' : 'sUSDS';
  const outAmt = usds ? sAmt * SPX : sAmt;
  const outDp = usds ? 2 : 4;
  const value = sAmt * SPX + phAmt * price;

  const stats: Stat[] = [];
  if (valid) {
    const left = Math.max(0, s.lp - burn);
    stats.push({ label: 'Pool price', value: `1 phUSD = ${fmt(rS / rPh, 4)} sUSDS ($${fmt(price, 4)})`, tone: 'default' });
    stats.push({
      label: 'LP tokens burned',
      value: `${fmt(burn, 4)} ${LP_SYMBOL} (${pct(s.lp > 0 ? burn / s.lp : 0)} of position)`,
      tone: 'default',
    });
    if (usds) stats.push({ label: 'sUSDS redeemed to USDS', value: `${fmt(sAmt, 4)} sUSDS × ${fmt(SPX, 4)}`, tone: 'default' });
    stats.push({
      label: `Min. received (${s.slip}% slippage)`,
      value: `${fmt(outAmt * (1 - slip), outDp)} ${outSym} + ${fmt(phAmt * (1 - slip), 2)} phUSD`,
      tone: 'default',
    });
    stats.push({ label: 'Remaining position', value: `${fmt(left, 4)} ${LP_SYMBOL} · ${pct(left / TS)} of pool`, tone: 'default' });
    stats.push({ label: 'Withdrawal value', value: usd(value), tone: 'default' });
    stats.push({
      label: 'Allowance',
      value: needApprove ? `Approve ${LP_SYMBOL} for ${usds ? 'zap' : 'router'} first` : `${LP_SYMBOL} approved`,
      tone: needApprove ? 'approve' : 'default',
    });
  }

  return {
    burn, lp: s.lp, usds, valid, over, spender, needApprove,
    method: usds ? METHODS.zapRemoveLiquidityToUSDS : METHODS.routerRemoveLiquidity,
    sAmt, phAmt, outSym, outAmt, outDp, value, stats,
  };
}

/** Burn-input string for a quick-pick fraction of the position (Max = the exact balance). */
export function removePctInput(lp: number, p: number): string {
  return p === 1 ? String(lp) : raw(lp * p, 6);
}

/** A quick-pick chip is selected when the burn equals that fraction of a non-empty position. */
export function removePctSelected(lp: number, burn: number, p: number): boolean {
  return lp > 0 && Math.abs(burn - lp * p) < 1e-6;
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
  /** Approval map key this step satisfies (approve steps only). */
  approvalKey?: string;
  label: string;
  /** Contract call shown under the label. */
  sub: string;
}

function approveStep(sym: ApprovableSymbol, spender: SpenderKey): ReviewStep {
  return {
    kind: 'approve',
    sym,
    approvalKey: approvalKey(sym, spender),
    label: `Approve ${sym}`,
    sub: `${sym}.approve(${SPENDERS[spender]})`,
  };
}

export function swapSteps(q: SwapQuote): ReviewStep[] {
  const steps: ReviewStep[] = [];
  if (q.needApprove) steps.push(approveStep(q.approveSym, q.spender));
  steps.push({
    kind: 'action',
    label: `Swap ${q.inSym} for ${q.outSym}${q.direct ? '' : ` (${q.syms.length - 1} hops)`}`,
    sub: q.method,
  });
  return steps;
}

export function addSteps(q: AddQuote): ReviewStep[] {
  const steps: ReviewStep[] = [];
  if (q.needTok) steps.push(approveStep(q.depositSym, q.spender));
  if (q.needPh) steps.push(approveStep('phUSD', q.spender));
  steps.push({
    kind: 'action',
    label: q.depositSym === 'USDS' ? 'Supply USDS + phUSD (wraps to sUSDS)' : 'Supply sUSDS + phUSD',
    sub: q.method,
  });
  return steps;
}

export function removeSteps(q: RemoveQuote): ReviewStep[] {
  const steps: ReviewStep[] = [];
  if (q.needApprove) steps.push(approveStep(LP_SYMBOL, q.spender));
  steps.push({
    kind: 'action',
    label: q.usds ? 'Remove liquidity & redeem sUSDS → USDS' : 'Remove liquidity',
    sub: q.method,
  });
  return steps;
}

export interface Cta {
  label: string;
  enabled: boolean;
}

export function swapCta(q: SwapQuote): Cta {
  if (q.noLiq) return { label: 'Insufficient liquidity', enabled: false };
  if (!q.valid) return { label: 'Enter an amount', enabled: false };
  if (q.insufficient) return { label: `Insufficient ${q.inSym} balance`, enabled: false };
  if (q.impact > MAX_PRICE_IMPACT) return { label: 'Price impact too high', enabled: false };
  return { label: 'Review swap', enabled: true };
}

export function addCta(q: AddQuote): Cta {
  if (!q.valid) return { label: 'Enter an amount', enabled: false };
  if (q.insufficient) return { label: `Insufficient ${q.insufficient} balance`, enabled: false };
  return { label: 'Review supply', enabled: true };
}

export function removeCta(q: RemoveQuote): Cta {
  if (q.lp <= 0) return { label: 'No liquidity to remove', enabled: false };
  if (!q.valid) return { label: 'Enter an amount', enabled: false };
  if (q.over) return { label: `Insufficient ${LP_SYMBOL} balance`, enabled: false };
  return { label: 'Review removal', enabled: true };
}

/** "Direct · 1 hop" or "N hops · 1 transaction". */
export function routeSummary(syms: readonly MarketSymbol[]): string {
  const hops = syms.length - 1;
  return hops === 1 ? 'Direct · 1 hop' : `${hops} hops · 1 transaction`;
}

/** "Via USDC → USDS → sUSDS" hint for the picker, or "direct pair". */
export function routeHint(sym: SwapTokenSymbol): string {
  const hops = TOKENS[sym].hops;
  return hops.length ? `via ${hops.map((h) => h.to).join(' → ')}` : 'direct pair';
}

