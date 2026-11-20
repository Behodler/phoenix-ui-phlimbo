import { describe, expect, it } from 'vitest';
import {
  discountPercent,
  formatAge,
  formatCount,
  formatStable,
  formatTokenAmount,
  formatUtc,
  formatUtcDate,
  newestFirst,
  shortAddress,
  summarizeAnnihilations,
  summarizeBatchMints,
  summarizeBurns,
  sumRaw,
  toBigInt,
  etherscanAddressUrl,
  etherscanTxUrl,
} from './historyFormat';
import { DOLA, FIXTURE_NOW_MS, UNKNOWN_STABLE, USDC, USDS, makeHistoryFixture } from './historyFixture';

const fixture = makeHistoryFixture();

describe('token amounts', () => {
  it('formats 18-dp Antimatter / phUSD to 2 dp', () => {
    expect(formatTokenAmount('12015200000000000000', 18)).toBe('12.02');
    expect(formatTokenAmount('2000480000000000000000', 18)).toBe('2,000.48');
  });

  it('keeps precision beyond 2^53 by summing in bigint', () => {
    // Three ~1e21 values; Number() on the raw strings would already lose digits.
    const total = sumRaw(['1000000000000000000001', '1000000000000000000001', '1000000000000000000001']);
    expect(total).toBe(3000000000000000000003n);
    expect(formatTokenAmount(total, 18)).toBe('3,000.00');
  });

  it('formats a 6-dp USDC stable and 18-dp DOLA / USDS stables via the tokens map', () => {
    const [usdcRow, dolaRow, usdsRow] = fixture.annihilations;
    expect(formatStable(fixture.tokens, usdcRow)).toEqual({ amount: '12.02', symbol: 'USDC' });
    expect(formatStable(fixture.tokens, dolaRow)).toEqual({ amount: '1,000.48', symbol: 'DOLA' });
    expect(formatStable(fixture.tokens, usdsRow)).toEqual({ amount: '75.53', symbol: 'USDS' });
    expect(usdcRow.stable).toBe(USDC);
    expect(dolaRow.stable).toBe(DOLA);
    expect(usdsRow.stable).toBe(USDS);
  });

  it('hides the amount of a stable missing from tokens and shows its short address', () => {
    expect(formatStable(fixture.tokens, { stable: UNKNOWN_STABLE, stableAmount: '5' })).toEqual({
      amount: null,
      symbol: '0x1111…1111',
    });
  });

  it('treats an unparsable uint string as zero', () => {
    expect(toBigInt('not-a-number')).toBe(0n);
    expect(formatCount(1234n)).toBe('1,234');
  });
});

describe('time and addresses', () => {
  it('formats relative ages', () => {
    const now = FIXTURE_NOW_MS;
    const s = now / 1000;
    expect(formatAge(s - 10, now)).toBe('just now');
    expect(formatAge(s - 12 * 60, now)).toBe('12m ago');
    expect(formatAge(s - 2 * 3600, now)).toBe('2h ago');
    expect(formatAge(s - 26 * 3600, now)).toBe('1d ago');
    expect(formatAge(s + 30, now)).toBe('just now');
  });

  it('formats absolute UTC times and dates', () => {
    const ts = Date.UTC(2026, 10, 18, 14, 3) / 1000;
    expect(formatUtc(ts)).toBe('2026-11-18 14:03 UTC');
    expect(formatUtcDate(ts)).toBe('18 Nov 2026');
  });

  it('shortens addresses and builds Etherscan links', () => {
    expect(shortAddress('0x3f2a0000000000000000000000000000000000a91c')).toBe('0x3f2a…a91c');
    expect(etherscanAddressUrl('0xabc')).toBe('https://etherscan.io/address/0xabc');
    expect(etherscanTxUrl('0xdef')).toBe('https://etherscan.io/tx/0xdef');
  });

  it('orders rows newest first by (blockNumber, logIndex)', () => {
    const rows = [
      { blockNumber: 1, logIndex: 0 },
      { blockNumber: 2, logIndex: 1 },
      { blockNumber: 2, logIndex: 5 },
    ];
    expect(newestFirst(rows)).toEqual([rows[2], rows[1], rows[0]]);
    expect(rows[0]).toEqual({ blockNumber: 1, logIndex: 0 }); // input untouched
  });
});

describe('summaries', () => {
  it('summarises annihilations including a source:"stake" row', () => {
    const s = summarizeAnnihilations(fixture.annihilations);
    expect(s.count).toBe(3);
    expect(s.viaForge).toBe(2);
    expect(s.viaStake).toBe(1);
    expect(formatTokenAmount(s.antimatterRaw, 18)).toBe('1,087.52'); // 12.0152 + 1000 + 75.5
    expect(formatTokenAmount(s.phUSDRaw, 18)).toBe('2,175.54'); // 24.0304 + 2000.48 + 151.03
  });

  it('summarises burns: 7d count, latest payout, total', () => {
    const s = summarizeBurns(fixture.bonfireBurns, FIXTURE_NOW_MS);
    expect(s.burns7d).toBe(2);
    expect(s.lastPayoutRaw).toBe(18666666666666666666n);
    expect(formatTokenAmount(s.totalPaidRaw, 18)).toBe('36.17'); // 5 + 12.5 + 18.666…
    expect(summarizeBurns([], FIXTURE_NOW_MS).lastPayoutRaw).toBeNull();
  });

  it('computes discount percentages', () => {
    expect(discountPercent(12n, 18n)).toBe(40);
    expect(discountPercent(15n, 15n)).toBe(50);
    expect(discountPercent(4n, 10n)).toBe(29); // 28.57 → 29
    expect(discountPercent(1n, 2n)).toBe(33);
    expect(discountPercent(0n, 0n)).toBe(0);
  });

  it('summarises batch mints', () => {
    const s = summarizeBatchMints(fixture.batchMints);
    expect(s.batches).toBe(2);
    expect(s.mintedTotal).toBe(60n);
    expect(s.freeTotal).toBe(27n);
    expect(s.avgDiscountPercent).toBe(45); // 27 / 60
    expect(s.firstTimestamp).toBe(fixture.batchMints[0].timestamp);
    expect(formatTokenAmount(fixture.batchMints[1].paidCost, 18)).toBe('2,412.00');

    const empty = summarizeBatchMints([]);
    expect(empty).toMatchObject({ batches: 0, mintedTotal: 0n, freeTotal: 0n, avgDiscountPercent: 0, firstTimestamp: null });
  });
});
