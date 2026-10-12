import { describe, it, expect } from 'vitest';
import { INITIAL_APPROVALS, LP_BAL, POOL, SPX, TOKENS, approvalKey } from '../data/uniMarketMockData';
import {
  addCta,
  addQuote,
  addSteps,
  amtIn,
  amtOut,
  clean,
  phPrice,
  positionView,
  removeCta,
  removeModalStats,
  removePctInput,
  removePctLabel,
  removePctSelected,
  removeQuote,
  removeSteps,
  routeFee,
  routeSummary,
  swapCta,
  swapQuote,
  swapSteps,
  type AddInput,
  type RemoveInput,
  type SwapInput,
} from './uniV2MockMath';

const { rS, rPh } = POOL;

const swapIn = (p: Partial<SwapInput>): SwapInput => ({
  tok: 'USDC', dir: 'buy', edited: 'pay', pay: '', recv: '', slip: 0.5, approvals: INITIAL_APPROVALS, ...p,
});
const rmIn = (p: Partial<RemoveInput>): RemoveInput => ({
  rLp: '', lp: LP_BAL, out: 'sUSDS', slip: 0.5, approvals: INITIAL_APPROVALS, ...p,
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

describe('positionView (story 085)', () => {
  const TS = Math.sqrt(rS * rPh);

  it('splits an LP balance into its pro-rata reserves and values them', () => {
    const v = positionView(1200);
    expect(v.lp).toBe(1200);
    expect(v.share).toBeCloseTo(1200 / TS, 12);
    expect(v.s).toBeCloseTo((1200 / TS) * rS, 9);
    expect(v.ph).toBeCloseTo((1200 / TS) * rPh, 9);
    expect(v.value).toBeCloseTo(v.s * SPX + v.ph * phPrice(rS, rPh), 9);
    // At the pool ratio both sides are worth the same.
    expect(v.s * SPX).toBeCloseTo(v.ph * phPrice(rS, rPh), 9);
  });

  it('is all zeros for an empty position', () => {
    expect(positionView(0)).toEqual({ lp: 0, share: 0, s: 0, ph: 0, value: 0 });
  });
});

describe('removeQuote (story 085)', () => {
  const TS = Math.sqrt(rS * rPh);
  const labels = (q: { stats: { label: string }[] }) => q.stats.map((s) => s.label);
  const stat = (q: { stats: { label: string; value: string }[] }, l: string) => q.stats.find((s) => s.label === l)?.value;

  it('sUSDS out: router, pro-rata sUSDS + phUSD, no redemption row', () => {
    const q = removeQuote(rmIn({ rLp: '600' }));
    expect(q.burn).toBe(600);
    expect(q.valid).toBe(true);
    expect(q.over).toBe(false);
    expect(q.spender).toBe('router');
    expect(q.method).toBe('router.removeLiquidity');
    expect(q.outSym).toBe('sUSDS');
    expect(q.sAmt).toBeCloseTo((600 / TS) * rS, 9);
    expect(q.phAmt).toBeCloseTo((600 / TS) * rPh, 9);
    expect(q.outAmt).toBe(q.sAmt);
    expect(q.outDp).toBe(4);
    expect(q.value).toBeCloseTo(q.sAmt * SPX + q.phAmt * phPrice(rS, rPh), 9);
    expect(labels(q)).toEqual([
      'Pool price',
      'LP tokens burned',
      'Min. received (0.5% slippage)',
      'Remaining position',
      'Withdrawal value',
      'Allowance',
    ]);
    expect(stat(q, 'LP tokens burned')).toBe('600.0000 UNI-V2 (50.00% of position)');
    expect(stat(q, 'Remaining position')).toBe(`600.0000 UNI-V2 · ${((600 / TS) * 100).toFixed(2)}% of pool`);
  });

  it('USDS out: zap, sUSDS redeemed at SPX, extra redemption row, 2dp', () => {
    const q = removeQuote(rmIn({ rLp: '600', out: 'USDS' }));
    expect(q.spender).toBe('zap');
    expect(q.method).toBe('zap.removeLiquidityToUSDS');
    expect(q.outSym).toBe('USDS');
    expect(q.outAmt).toBeCloseTo(q.sAmt * SPX, 9);
    expect(q.outDp).toBe(2);
    expect(labels(q)).toEqual([
      'Pool price',
      'LP tokens burned',
      'sUSDS redeemed to USDS',
      'Min. received (0.5% slippage)',
      'Remaining position',
      'Withdrawal value',
      'Allowance',
    ]);
    expect(stat(q, 'sUSDS redeemed to USDS')).toMatch(/ sUSDS × 1\.0735$/);
  });

  it('min. received applies slippage to both legs', () => {
    const q = removeQuote(rmIn({ rLp: '600', slip: 1 }));
    const fmt2 = (n: number, d: number) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    expect(stat(q, 'Min. received (1% slippage)')).toBe(`${fmt2(q.sAmt * 0.99, 4)} sUSDS + ${fmt2(q.phAmt * 0.99, 2)} phUSD`);
  });

  it('flags burning more than the balance; Max is not over', () => {
    expect(removeQuote(rmIn({ rLp: '1200.0001' })).over).toBe(true);
    expect(removeQuote(rmIn({ rLp: '1200' })).over).toBe(false);
    expect(stat(removeQuote(rmIn({ rLp: '1200' })), 'Remaining position')).toBe('0.0000 UNI-V2 · 0.00% of pool');
  });

  it('no stats without an amount', () => {
    const q = removeQuote(rmIn({ rLp: '' }));
    expect(q.valid).toBe(false);
    expect(q.stats).toEqual([]);
  });

  it('allowance is per spender and starts unapproved on both', () => {
    expect(stat(removeQuote(rmIn({ rLp: '1' })), 'Allowance')).toBe('Approve UNI-V2 for router first');
    expect(stat(removeQuote(rmIn({ rLp: '1', out: 'USDS' })), 'Allowance')).toBe('Approve UNI-V2 for zap first');
    expect(removeQuote(rmIn({ rLp: '1' })).stats.at(-1)?.tone).toBe('approve');
    const routerOnly = { [approvalKey('UNI-V2', 'router')]: true };
    const r = removeQuote(rmIn({ rLp: '1', approvals: routerOnly }));
    expect(stat(r, 'Allowance')).toBe('UNI-V2 approved');
    expect(r.stats.at(-1)?.tone).toBe('default');
    // Router approval does not count for the zap.
    expect(removeQuote(rmIn({ rLp: '1', out: 'USDS', approvals: routerOnly })).needApprove).toBe(true);
  });

  it('steps: approve UNI-V2 to the matching spender, then the action', () => {
    expect(removeSteps(removeQuote(rmIn({ rLp: '10' }))).map((s) => [s.label, s.sub])).toEqual([
      ['Approve UNI-V2', 'UNI-V2.approve(UniswapV2Router02)'],
      ['Remove liquidity', 'router.removeLiquidity'],
    ]);
    const usdsSteps = removeSteps(removeQuote(rmIn({ rLp: '10', out: 'USDS' })));
    expect(usdsSteps.map((s) => [s.label, s.sub])).toEqual([
      ['Approve UNI-V2', 'UNI-V2.approve([LIQUIDITY_ZAP])'],
      ['Remove liquidity & redeem sUSDS → USDS', 'zap.removeLiquidityToUSDS'],
    ]);
    expect(usdsSteps[0].approvalKey).toBe(approvalKey('UNI-V2', 'zap'));
    const approved = { [approvalKey('UNI-V2', 'zap')]: true };
    expect(removeSteps(removeQuote(rmIn({ rLp: '10', out: 'USDS', approvals: approved }))).map((s) => s.kind)).toEqual(['action']);
  });

  it('CTA states in order: no liquidity → enter amount → insufficient → review', () => {
    // lp ≤ 0 wins even with an over-balance amount typed
    expect(removeCta(removeQuote(rmIn({ lp: 0, rLp: '5' })))).toEqual({ label: 'No liquidity to remove', enabled: false });
    expect(removeCta(removeQuote(rmIn({ rLp: '' })))).toEqual({ label: 'Enter an amount', enabled: false });
    expect(removeCta(removeQuote(rmIn({ rLp: '1300' })))).toEqual({ label: 'Insufficient UNI-V2 balance', enabled: false });
    expect(removeCta(removeQuote(rmIn({ rLp: '1200' })))).toEqual({ label: 'Review removal', enabled: true });
  });

  it('modal stats drop Pool price and Allowance only', () => {
    expect(removeModalStats(removeQuote(rmIn({ rLp: '600', out: 'USDS' }))).map((s) => s.label)).toEqual([
      'LP tokens burned',
      'sUSDS redeemed to USDS',
      'Min. received (0.5% slippage)',
      'Remaining position',
      'Withdrawal value',
    ]);
  });
});

describe('remove % chips (story 085)', () => {
  it('labels and inputs: Max is the exact balance, others rounded to 6dp', () => {
    expect([0.25, 0.5, 0.75, 1].map(removePctLabel)).toEqual(['25%', '50%', '75%', 'Max']);
    expect(removePctInput(1200, 0.25)).toBe('300');
    expect(removePctInput(1200, 1)).toBe('1200');
    expect(removePctInput(1000.123456789, 1)).toBe('1000.123456789');
    expect(removePctInput(10, 1 / 3)).toBe('3.333333');
  });

  it('a chip is selected only when the burn matches its fraction of a non-empty position', () => {
    expect(removePctSelected(1200, 600, 0.5)).toBe(true);
    expect(removePctSelected(1200, 600.01, 0.5)).toBe(false);
    expect(removePctSelected(0, 0, 0.25)).toBe(false);
  });
});
