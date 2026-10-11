import { describe, it, expect } from 'vitest';
import { INITIAL_APPROVALS, POOL, SPX, TOKENS, approvalKey } from '../data/uniMarketMockData';
import {
  addCta,
  addQuote,
  addSteps,
  amtIn,
  amtOut,
  clean,
  phPrice,
  routeFee,
  routeSummary,
  swapCta,
  swapQuote,
  swapSteps,
  type AddInput,
  type SwapInput,
} from './uniV2MockMath';

const { rS, rPh } = POOL;

const swapIn = (p: Partial<SwapInput>): SwapInput => ({
  tok: 'USDC', dir: 'buy', edited: 'pay', pay: '', recv: '', slip: 0.5, approvals: INITIAL_APPROVALS, ...p,
});
const addIn = (p: Partial<AddInput>): AddInput => ({
  depositSym: 'USDS', aTok: '', aPh: '', edited: 'tok', slip: 0.5, approvals: INITIAL_APPROVALS, ...p,
});

describe('Uniswap V2 core', () => {
  it('amtOut / amtIn round-trip', () => {
    const x = 1234.5;
    const y = amtOut(x, rS, rPh);
    expect(amtIn(y, rS, rPh)).toBeCloseTo(x, 8);
  });

  it('amtOut applies the 0.3% fee', () => {
    // Tiny trade: output ≈ input × price × 0.997
    expect(amtOut(1, rS, rPh)).toBeCloseTo((rPh / rS) * 0.997, 4);
  });

  it('amtIn is Infinity when the output would drain the reserve', () => {
    expect(amtIn(rPh, rS, rPh)).toBe(Infinity);
    expect(amtIn(rPh + 1, rS, rPh)).toBe(Infinity);
    expect(Number.isFinite(amtIn(rPh - 1, rS, rPh))).toBe(true);
  });

  it('phPrice = rS / rPh × SPX', () => {
    expect(phPrice(rS, rPh)).toBeCloseTo((369600 / 400000) * 1.0735, 12);
  });

  it('routeFee compounds hop fees (DOLA: Curve 0.01%, ETH: V3 0.05%, direct: 0)', () => {
    expect(routeFee(TOKENS.DOLA.hops)).toBeCloseTo(0.0001, 12);
    expect(routeFee(TOKENS.ETH.hops)).toBeCloseTo(0.0005, 12);
    expect(routeFee(TOKENS.USDC.hops)).toBe(0);
    expect(routeFee(TOKENS.sUSDS.hops)).toBe(0);
  });
});

describe('clean', () => {
  it('turns commas into dots', () => expect(clean('1,5')).toBe('1.5'));
  it('keeps only the first dot', () => expect(clean('1.2.3')).toBe('1.23'));
  it('strips non-numeric characters', () => expect(clean('a1b2-3 x')).toBe('123'));
  it('handles empty input', () => expect(clean('')).toBe(''));
});

describe('swapQuote', () => {
  it('buy with USDC (exact in) routes 3 hops through the zap', () => {
    const q = swapQuote(swapIn({ pay: '1000' }));
    const sLeg = 1000 / SPX;
    expect(q.valid).toBe(true);
    expect(q.sLeg).toBeCloseTo(sLeg, 9);
    expect(q.outA).toBeCloseTo(amtOut(sLeg, rS, rPh), 9);
    expect(q.syms).toEqual(['USDC', 'USDS', 'sUSDS', 'phUSD']);
    expect(q.venues).toEqual(['Sky PSM 1:1', 'Sky savings deposit', 'Uniswap V2 · 0.30%']);
    expect(routeSummary(q.syms)).toBe('3 hops · 1 transaction');
    expect(q.method).toBe('zap.swapToPhUSD');
    expect(q.spender).toBe('swapZap');
    expect(q.needApprove).toBe(true);
    expect(q.priceAfter).toBeGreaterThan(q.priceBefore);
    expect(q.stats.map((s) => s.label)).toContain('Minimum received (0.5% slippage)');
  });

  it('sell to USDC (exact in) reverses the route with venueRev labels', () => {
    const q = swapQuote(swapIn({ dir: 'sell', pay: '500' }));
    const sLeg = amtOut(500, rPh, rS);
    expect(q.inSym).toBe('phUSD');
    expect(q.outA).toBeCloseTo(sLeg * SPX, 9);
    expect(q.syms).toEqual(['phUSD', 'sUSDS', 'USDS', 'USDC']);
    expect(q.venues).toEqual(['Uniswap V2 · 0.30%', 'Sky savings redeem', 'Sky PSM 1:1']);
    expect(q.method).toBe('zap.swapFromPhUSD');
    expect(q.priceAfter).toBeLessThan(q.priceBefore);
  });

  it('sUSDS is a direct pair through the router', () => {
    const buy = swapQuote(swapIn({ tok: 'sUSDS', pay: '100' }));
    expect(buy.direct).toBe(true);
    expect(buy.outA).toBeCloseTo(amtOut(100, rS, rPh), 9);
    expect(routeSummary(buy.syms)).toBe('Direct · 1 hop');
    expect(buy.method).toBe('router.swapExactTokensForTokens');
    expect(buy.spender).toBe('router');

    const sellExactOut = swapQuote(swapIn({ tok: 'sUSDS', dir: 'sell', edited: 'recv', recv: '100' }));
    expect(sellExactOut.inA).toBeCloseTo(amtIn(100, rPh, rS), 9);
    expect(sellExactOut.method).toBe('router.swapTokensForExactTokens');
    expect(sellExactOut.stats.map((s) => s.label)).toContain('Maximum sold (0.5% slippage)');
  });

  it('exact-out buy back-computes the input', () => {
    const q = swapQuote(swapIn({ edited: 'recv', recv: '100' }));
    expect(q.inA).toBeCloseTo((amtIn(100, rS, rPh) * SPX) / 1, 9);
    expect(q.exactIn).toBe(false);
  });

  it('DOLA route fee shows in the fee label', () => {
    const q = swapQuote(swapIn({ tok: 'DOLA', pay: '100' }));
    expect(q.stats.find((s) => s.label.startsWith('Fees'))?.label).toBe('Fees (0.30% pool + 0.01% route)');
    expect(q.needApprove).toBe(false); // DOLA starts approved
  });

  it('native ETH never needs approval when buying', () => {
    const q = swapQuote(swapIn({ tok: 'ETH', pay: '0.1' }));
    expect(q.needApprove).toBe(false);
    expect(q.method).toBe('zap.swapETHToPhUSD');
    expect(q.stats.find((s) => s.label === 'Allowance')?.value).toBe('Not needed (native ETH)');
  });

  it('flags insufficient liquidity on exact-out beyond the reserve', () => {
    const q = swapQuote(swapIn({ edited: 'recv', recv: String(rPh) }));
    expect(q.noLiq).toBe(true);
    expect(swapCta(q).label).toBe('Insufficient liquidity');
  });

  it('CTA state machine', () => {
    expect(swapCta(swapQuote(swapIn({}))).label).toBe('Enter an amount');
    expect(swapCta(swapQuote(swapIn({ pay: '5000' })))).toEqual({ label: 'Insufficient USDC balance', enabled: false });
    const ok = swapQuote(swapIn({ pay: '100' }));
    expect(swapCta(ok)).toEqual({ label: 'Review swap', enabled: true });
    expect(swapCta({ ...ok, impact: 0.2 }).label).toBe('Price impact too high');
  });

  it('approve step only when not yet approved for that spender', () => {
    const q = swapQuote(swapIn({ pay: '100' }));
    expect(swapSteps(q).map((s) => s.sub)).toEqual(['USDC.approve([ZAP_ROUTER])', 'zap.swapToPhUSD']);
    const approved = swapQuote(swapIn({ pay: '100', approvals: { [approvalKey('USDC', 'swapZap')]: true } }));
    expect(swapSteps(approved).map((s) => s.kind)).toEqual(['action']);
  });
});

describe('addQuote', () => {
  const TS = Math.sqrt(rS * rPh);

  it('sUSDS path links amounts at the pool ratio and mints LP', () => {
    const q = addQuote(addIn({ depositSym: 'sUSDS', aTok: '369.6' }));
    expect(q.b).toBeCloseTo(400, 9);
    expect(q.lp).toBeCloseTo((369.6 * TS) / rS, 9);
    expect(q.share).toBeCloseTo(q.lp / (TS + q.lp), 12);
    expect(q.method).toBe('router.addLiquidity');
    expect(q.stats.map((s) => s.label)).not.toContain('Wrapped to sUSDS');
  });

  it('USDS path converts to sUSDS at SPX before applying the ratio', () => {
    const q = addQuote(addIn({ aTok: '1073.5' }));
    expect(q.s).toBeCloseTo(1000, 9);
    expect(q.b).toBeCloseTo((1000 * rPh) / rS, 9);
    expect(q.lp).toBeCloseTo((1000 * TS) / rS, 9);
    expect(q.method).toBe('zap.addLiquidityWithUSDS');
    expect(q.stats.find((s) => s.label === 'Wrapped to sUSDS')?.value).toBe('1,000.0000 sUSDS via Sky savings deposit');
    expect(q.stats.find((s) => s.label === 'Deposited')?.value).toMatch(/^1,073\.50 USDS \+ /);
  });

  it('editing phUSD back-computes sUSDS then USDS', () => {
    const q = addQuote(addIn({ aPh: '400', edited: 'ph' }));
    expect(q.s).toBeCloseTo(369.6, 9);
    expect(q.a).toBeCloseTo(369.6 * SPX, 9);
  });

  it('balance checks use the selected token', () => {
    expect(addQuote(addIn({ aTok: '700' })).insufficient).toBe('USDS'); // USDS bal 640.5
    expect(addQuote(addIn({ depositSym: 'sUSDS', aTok: '700' })).insufficient).toBe(''); // sUSDS bal 812.4
    expect(addCta(addQuote(addIn({ aTok: '700' }))).label).toBe('Insufficient USDS balance');
    expect(addCta(addQuote(addIn({ aTok: '100' })))).toEqual({ label: 'Review supply', enabled: true });
  });

  it('steps approve per token+spender: zap on the USDS path, router on the sUSDS path', () => {
    expect(addSteps(addQuote(addIn({ aTok: '100' }))).map((s) => s.sub)).toEqual([
      'USDS.approve([LIQUIDITY_ZAP])',
      'phUSD.approve([LIQUIDITY_ZAP])',
      'zap.addLiquidityWithUSDS',
    ]);
    expect(addSteps(addQuote(addIn({ depositSym: 'sUSDS', aTok: '100' }))).map((s) => s.sub)).toEqual([
      'sUSDS.approve(UniswapV2Router02)',
      'phUSD.approve(UniswapV2Router02)',
      'router.addLiquidity',
    ]);
    // phUSD approved to the router does not count for the zap
    const approvals = { [approvalKey('phUSD', 'router')]: true };
    expect(addSteps(addQuote(addIn({ aTok: '100', approvals }))).map((s) => s.label)).toEqual([
      'Approve USDS', 'Approve phUSD', 'Supply USDS + phUSD (wraps to sUSDS)',
    ]);
  });
});
