import { describe, it, expect } from 'vitest';
import { parseUnits } from 'viem';
import {
  addCta,
  addQuote,
  addSteps,
  buyImpact,
  ceilDiv,
  clean,
  fmtUnits,
  getAmountIn,
  getAmountOut,
  lpForDeposit,
  minOut,
  parseAmount,
  phPrice,
  positionView,
  rawUnits,
  removeCta,
  removeModalStats,
  removePctAmount,
  removePctLabel,
  removePctSelected,
  removeQuote,
  removeSteps,
  routeHint,
  routeSummary,
  sellImpact,
  swapCta,
  swapQuote,
  swapSteps,
  type AddInput,
  type PoolState,
  type RemoveInput,
  type SwapInput,
} from './uniV2Math';

const e18 = (n: string) => parseUnits(n, 18);
const e6 = (n: string) => parseUnits(n, 6);

/** A thin Anvil-like pool: 2000 phUSD / 1850 sUSDS, 1900 LP, sUSDS = 1.0735 USDS. */
const POOL: PoolState = { rPh: e18('2000'), rS: e18('1850'), totalSupply: e18('1900'), spx: e18('1.0735') };

const swapIn = (p: Partial<SwapInput>): SwapInput => ({
  tok: 'USDC', dir: 'buy', inWei: 0n, quoteOut: undefined, quoteLoading: false, quoteError: false, slip: 0.5,
  pool: POOL, inBal: e6('10000'), allowance: 0n, ethUsd: 2000, ...p,
});
const addIn = (p: Partial<AddInput>): AddInput => ({
  depositSym: 'sUSDS', edited: 'tok', tokWei: 0n, phWei: 0n, previewShares: undefined, slip: 0.5, pool: POOL,
  tokBal: e18('10000'), phBal: e18('10000'), tokAllowance: 0n, phAllowance: 0n, ...p,
});
const rmIn = (p: Partial<RemoveInput>): RemoveInput => ({
  burnWei: 0n, lpBal: e18('100'), out: 'sUSDS', previewUsds: undefined, slip: 0.5, pool: POOL, allowance: 0n, ...p,
});

describe('input + formatting', () => {
  it('clean: commas → dots, one dot, digits only', () => {
    expect(clean('1,5.2x')).toBe('1.52');
  });

  it('parseAmount truncates excess decimals instead of rounding up', () => {
    expect(parseAmount('1.1234567', 6)).toBe(1_123_456n);
    expect(parseAmount('', 18)).toBe(0n);
    expect(parseAmount('.', 18)).toBe(0n);
    expect(parseAmount('0', 18)).toBe(0n);
  });

  it('fmtUnits floors (never rounds up) and groups thousands', () => {
    expect(fmtUnits(e18('1234.56789'), 18, 2)).toBe('1,234.56');
    expect(fmtUnits(e18('0.999999'), 18, 4)).toBe('0.9999');
    expect(fmtUnits(e6('5'), 6, 2)).toBe('5.00');
  });

  it('rawUnits floors to dp and strips trailing zeros', () => {
    expect(rawUnits(e18('1.23456789'), 18, 4)).toBe('1.2345');
    expect(rawUnits(e18('2.5'), 18, 6)).toBe('2.5');
    expect(rawUnits(0n, 18, 6)).toBe('');
  });
});

describe('min-out flooring', () => {
  it('quote × (10000 − bps) / 10000, floored in the protocol’s favour', () => {
    expect(minOut(10_000n, 0.5)).toBe(9_950n);
    // 999 × 9950 / 10000 = 994.005 → 994
    expect(minOut(999n, 0.5)).toBe(994n);
    expect(minOut(1n, 0.1)).toBe(0n);
    expect(minOut(e18('100'), 1)).toBe(e18('99'));
  });

  it('the swap stat shows the same floored bigint that is sent', () => {
    const q = swapQuote(swapIn({ inWei: e6('100'), quoteOut: 93_123_456_789_012_345_678n }));
    expect(q.minOutWei).toBe((93_123_456_789_012_345_678n * 9950n) / 10000n);
    const stat = q.stats.find((s) => s.label === 'Minimum received (0.5% slippage)');
    expect(stat?.value).toBe(`${fmtUnits(q.minOutWei, 18, 2)} phUSD`);
  });
});

describe('Uniswap V2 core (bigint)', () => {
  it('getAmountOut applies the 0.3% fee and floors', () => {
    const out = getAmountOut(e18('1'), POOL.rS, POOL.rPh);
    const expected = (e18('1') * 997n * POOL.rPh) / (POOL.rS * 1000n + e18('1') * 997n);
    expect(out).toBe(expected);
  });

  it('getAmountIn is the inverse (+1 wei rounding) and null when draining', () => {
    const out = e18('10');
    const inp = getAmountIn(out, POOL.rS, POOL.rPh);
    expect(inp).not.toBeNull();
    expect(getAmountOut(inp!, POOL.rS, POOL.rPh)).toBeGreaterThanOrEqual(out);
    expect(getAmountIn(POOL.rPh, POOL.rS, POOL.rPh)).toBeNull();
  });

  it('ceilDiv rounds up', () => {
    expect(ceilDiv(10n, 3n)).toBe(4n);
    expect(ceilDiv(9n, 3n)).toBe(3n);
  });

  it('phPrice = rS / rPh × spx', () => {
    expect(phPrice(1850, 2000, 1.0735)).toBeCloseTo((1850 / 2000) * 1.0735, 12);
  });
});

describe('price impact from reserves', () => {
  it('a tiny trade has ~zero impact; impact grows with size', () => {
    expect(buyImpact(0.997 * 2000 / 1850 * 0.001, 0.001, 1850, 2000)).toBeCloseTo(0, 6);
    const sOutSmall = Number(getAmountOut(e18('1'), POOL.rPh, POOL.rS)) / 1e18;
    const sOutBig = Number(getAmountOut(e18('500'), POOL.rPh, POOL.rS)) / 1e18;
    expect(sellImpact(sOutSmall, 1, 1850, 2000)).toBeLessThan(0.001);
    expect(sellImpact(sOutBig, 500, 1850, 2000)).toBeGreaterThan(0.15);
  });

  it('swapQuote buy: impact from the V2 leg (getAmountIn of the quoted phUSD)', () => {
    const phOut = e18('100');
    const q = swapQuote(swapIn({ tok: 'sUSDS', inWei: e18('95'), quoteOut: phOut, allowance: e18('1000') }));
    const sIn = Number(getAmountIn(phOut, POOL.rS, POOL.rPh)!) / 1e18;
    expect(q.impact).toBeCloseTo(buyImpact(100, sIn, 1850, 2000), 12);
    expect(q.impact).toBeGreaterThan(0.04);
    expect(q.stats.find((s) => s.label === 'Price impact')?.tone).toBe('danger');
    expect(q.priceAfter).toBeGreaterThan(q.priceBefore);
  });

  it('swapQuote sell: price falls; a >15% impact blocks the CTA', () => {
    const q = swapQuote(swapIn({ tok: 'sUSDS', dir: 'sell', inWei: e18('600'), quoteOut: e18('400'), inBal: e18('1000'), allowance: e18('1000') }));
    expect(q.priceAfter).toBeLessThan(q.priceBefore);
    expect(q.impact).toBeGreaterThan(0.15);
    expect(swapCta(q, true)).toEqual({ label: 'Price impact too high', enabled: false });
  });
});

describe('swapQuote / steps / CTA', () => {
  it('USDC buy: 3-hop route with real venue labels, approve then UniswapHelper.swapToPhUSD', () => {
    const q = swapQuote(swapIn({ inWei: e6('10'), quoteOut: e18('10') }));
    expect(q.syms).toEqual(['USDC', 'USDS', 'sUSDS', 'phUSD']);
    expect(q.venues).toEqual(['Sky PSM', 'sUSDS deposit', 'Uniswap V2 · 0.30%']);
    expect(q.needApprove).toBe(true);
    const steps = swapSteps(q);
    expect(steps.map((s) => s.sub)).toEqual(['USDC.approve(UniswapHelper)', 'UniswapHelper.swapToPhUSD']);
    expect(steps[0].amount).toBe(e6('10'));
    expect(swapCta(q, true)).toEqual({ label: 'Review swap', enabled: true });
  });

  it('allowance ≥ amount skips the approve step', () => {
    const q = swapQuote(swapIn({ inWei: e6('10'), quoteOut: e18('10'), allowance: e6('10') }));
    expect(swapSteps(q).map((s) => s.kind)).toEqual(['action']);
    expect(q.stats.find((s) => s.label === 'Allowance')?.value).toBe('USDC approved');
  });

  it('ETH buy needs no approval and is valued at what it buys', () => {
    const q = swapQuote(swapIn({ tok: 'ETH', inWei: e18('0.01'), quoteOut: e18('19'), allowance: undefined, inBal: e18('5') }));
    expect(q.method).toBe('swapETHToPhUSD');
    expect(q.needApprove).toBe(false);
    expect(q.inUsd).toBe(q.outUsd);
    expect(swapSteps(q).map((s) => s.sub)).toEqual(['UniswapHelper.swapETHToPhUSD']);
  });

  it('sells pick swapFromPhUSD / swapPhUSDToETH and reverse the route', () => {
    const q = swapQuote(swapIn({ tok: 'DOLA', dir: 'sell', inWei: e18('5'), quoteOut: e18('5'), inBal: e18('10') }));
    expect(q.method).toBe('swapFromPhUSD');
    expect(q.syms).toEqual(['phUSD', 'sUSDS', 'USDS', 'USDC', 'DOLA']);
    expect(q.venues[0]).toBe('Uniswap V2 · 0.30%');
    expect(q.venues.at(-1)).toBe('Curve DOLA metapool');
    expect(swapQuote(swapIn({ tok: 'ETH', dir: 'sell', inWei: e18('5'), quoteOut: 1n })).method).toBe('swapPhUSDToETH');
  });

  it('fees stat shows only the 0.30% pool fee; non-direct routes note venue fees are in the quote', () => {
    const direct = swapQuote(swapIn({ tok: 'sUSDS', inWei: e18('1'), quoteOut: e18('1') }));
    const routed = swapQuote(swapIn({ inWei: e6('1'), quoteOut: e18('1') }));
    expect(direct.stats.find((s) => s.label === 'Fees (0.30% pool)')?.value).not.toMatch(/venue/);
    expect(routed.stats.find((s) => s.label === 'Fees (0.30% pool)')?.value).toMatch(/venue fees included in quote$/);
  });

  it('CTA states: empty, fetching, no liquidity, connect, insufficient balance', () => {
    expect(swapCta(swapQuote(swapIn({})), true).label).toBe('Enter an amount');
    expect(swapCta(swapQuote(swapIn({ inWei: 1n, quoteLoading: true })), true).label).toBe('Fetching quote…');
    expect(swapCta(swapQuote(swapIn({ inWei: 1n, quoteError: true })), true).label).toBe('Insufficient liquidity');
    expect(swapCta(swapQuote(swapIn({ inWei: e6('1'), quoteOut: e18('1') })), false).label).toBe('Connect wallet');
    expect(swapCta(swapQuote(swapIn({ inWei: e6('20000'), quoteOut: e18('1') })), true).label).toBe('Insufficient USDC balance');
  });
});

describe('addQuote (real totalSupply)', () => {
  it('paired phUSD follows the reserve ratio in bigint; LP = min(s·TS/rS, ph·TS/rPh), floored', () => {
    const q = addQuote(addIn({ tokWei: e18('100') }));
    expect(q.b).toBe((e18('100') * POOL.rPh) / POOL.rS);
    expect(q.lp).toBe(lpForDeposit(e18('100'), q.b, POOL));
    const lpA = (e18('100') * POOL.totalSupply) / POOL.rS;
    const lpB = (q.b * POOL.totalSupply) / POOL.rPh;
    expect(q.lp).toBe(lpA < lpB ? lpA : lpB);
    expect(q.share).toBeCloseTo(Number(q.lp) / (Number(POOL.totalSupply) + Number(q.lp)), 9);
    expect(q.aMin).toBe(minOut(q.a, 0.5));
    expect(q.bMin).toBe(minOut(q.b, 0.5));
    expect(q.method).toBe('addLiquiditySUSDS');
  });

  it('USDS path uses previewDeposit shares and addLiquidityUSDS', () => {
    const shares = e18('93');
    const q = addQuote(addIn({ depositSym: 'USDS', tokWei: e18('100'), previewShares: shares }));
    expect(q.s).toBe(shares);
    expect(q.b).toBe((shares * POOL.rPh) / POOL.rS);
    expect(q.method).toBe('addLiquidityUSDS');
    expect(q.stats.find((s) => s.label === 'Wrapped to sUSDS')).toBeDefined();
  });

  it('phUSD-edited USDS path rounds the USDS side up (refunded if unused)', () => {
    const q = addQuote(addIn({ depositSym: 'USDS', edited: 'ph', phWei: e18('10') }));
    const s = (e18('10') * POOL.rS) / POOL.rPh;
    expect(q.a).toBe(ceilDiv(s * POOL.spx, 10n ** 18n));
  });

  it('steps: approve deposit token and phUSD to UniswapHelper when allowances fall short', () => {
    const q = addQuote(addIn({ tokWei: e18('10'), phAllowance: e18('1000') }));
    expect(addSteps(q).map((s) => s.sub)).toEqual(['sUSDS.approve(UniswapHelper)', 'UniswapHelper.addLiquiditySUSDS']);
    const q2 = addQuote(addIn({ tokWei: e18('10') }));
    expect(addSteps(q2).map((s) => s.sym ?? 'action')).toEqual(['sUSDS', 'phUSD', 'action']);
  });

  it('CTA: insufficient phUSD balance', () => {
    const q = addQuote(addIn({ tokWei: e18('100'), phBal: e18('1') }));
    expect(addCta(q, true)).toEqual({ label: 'Insufficient phUSD balance', enabled: false });
  });
});

describe('positionView + removeQuote (real totalSupply)', () => {
  it('position underlying = lp × reserve / totalSupply, floored', () => {
    const p = positionView(e18('19'), POOL);
    expect(p.s).toBe((e18('19') * POOL.rS) / POOL.totalSupply);
    expect(p.ph).toBe((e18('19') * POOL.rPh) / POOL.totalSupply);
    expect(p.share).toBeCloseTo(0.01, 12);
    expect(positionView(0n, POOL).value).toBe(0);
  });

  it('remove amounts and mins are floored; USDS path uses previewRedeem', () => {
    const q = removeQuote(rmIn({ burnWei: e18('50') }));
    expect(q.sAmt).toBe((e18('50') * POOL.rS) / POOL.totalSupply);
    expect(q.phAmt).toBe((e18('50') * POOL.rPh) / POOL.totalSupply);
    expect(q.outMin).toBe(minOut(q.sAmt, 0.5));
    expect(q.method).toBe('removeLiquiditySUSDS');
    const u = removeQuote(rmIn({ burnWei: e18('50'), out: 'USDS', previewUsds: e18('52') }));
    expect(u.outAmt).toBe(e18('52'));
    expect(u.method).toBe('removeLiquidityUSDS');
    expect(removeModalStats(u).map((s) => s.label)).not.toContain('Allowance');
  });

  it('LP approval step targets UniswapHelper; CTA states', () => {
    const q = removeQuote(rmIn({ burnWei: e18('50') }));
    expect(removeSteps(q).map((s) => s.sub)).toEqual(['UNI-V2.approve(UniswapHelper)', 'UniswapHelper.removeLiquiditySUSDS']);
    expect(removeCta(q, true).label).toBe('Review removal');
    expect(removeCta(removeQuote(rmIn({ burnWei: e18('101') })), true).label).toBe('Insufficient UNI-V2 balance');
    expect(removeCta(removeQuote(rmIn({ lpBal: 0n, burnWei: e18('1') })), true).label).toBe('No liquidity to remove');
    expect(removeCta(q, false).label).toBe('Connect wallet');
  });

  it('pct chips: exact bigint fractions; Max is the whole balance', () => {
    expect(removePctAmount(e18('100'), 0.25)).toBe(e18('25'));
    expect(removePctAmount(e18('100'), 1)).toBe(e18('100'));
    expect(removePctSelected(e18('100'), e18('50'), 0.5)).toBe(true);
    expect(removePctSelected(e18('100'), e18('51'), 0.5)).toBe(false);
    expect(removePctLabel(1)).toBe('Max');
    expect(removePctLabel(0.75)).toBe('75%');
  });
});

describe('route labels', () => {
  it('routeSummary + routeHint', () => {
    expect(routeSummary(['sUSDS', 'phUSD'])).toBe('Direct · 1 hop');
    expect(routeSummary(['USDC', 'USDS', 'sUSDS', 'phUSD'])).toBe('3 hops · 1 transaction');
    expect(routeHint('USDC')).toBe('via USDS → sUSDS');
    expect(routeHint('sUSDS')).toBe('direct pair');
    expect(routeHint('ETH')).toBe('via USDC → USDS → sUSDS');
  });
});
