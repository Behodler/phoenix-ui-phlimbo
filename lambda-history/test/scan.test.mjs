// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { scanRange } from '../lib/scan.mjs';

const opts = { initialChunk: 1000, minChunk: 100, maxChunk: 1000 };

describe('scanRange', () => {
  it('covers the whole range in chunks and reports done', async () => {
    const calls = [];
    const res = await scanRange({
      ...opts,
      fromBlock: 1,
      toBlock: 2500,
      fetchChunk: async (f, t) => {
        calls.push([f, t]);
        return [f];
      },
    });
    expect(calls).toEqual([
      [1, 1000],
      [1001, 2000],
      [2001, 2500],
    ]);
    expect(res).toMatchObject({ lastScanned: 2500, stoppedBy: 'done', items: [1, 1001, 2001] });
  });

  it('halves the chunk on an RPC range error, retries the same start, then grows back', async () => {
    const calls = [];
    const res = await scanRange({
      ...opts,
      fromBlock: 1,
      toBlock: 1500,
      fetchChunk: async (f, t) => {
        calls.push([f, t]);
        if (t - f + 1 > 250) throw new Error('query returned more than 10000 results');
        return [];
      },
    });
    // 1000 → 500 → 250 fail/fail/ok; after success it doubles to 500, which fails again, etc.
    expect(calls.slice(0, 4)).toEqual([
      [1, 1000],
      [1, 500],
      [1, 250],
      [251, 750],
    ]);
    expect(res.lastScanned).toBe(1500);
    expect(res.stoppedBy).toBe('done');
    // every successful window was ≤ 250 and the successes tile the range exactly
    const ok = calls.filter(([f, t]) => t - f + 1 <= 250);
    expect(ok[0][0]).toBe(1);
    for (let i = 1; i < ok.length; i++) expect(ok[i][0]).toBe(ok[i - 1][1] + 1);
    expect(ok.at(-1)[1]).toBe(1500);
  });

  it('never goes below minChunk and stops with lastScanned at the last full chunk', async () => {
    const res = await scanRange({
      ...opts,
      fromBlock: 1,
      toBlock: 5000,
      fetchChunk: async (f) => {
        if (f > 1000) throw new Error('rate limited');
        return [];
      },
    });
    expect(res.stoppedBy).toBe('error');
    expect(res.lastScanned).toBe(1000);
    expect(res.chunk).toBe(100);
  });

  it('stops cleanly on the time budget without advancing past scanned blocks', async () => {
    let n = 0;
    const res = await scanRange({
      ...opts,
      fromBlock: 101,
      toBlock: 10_000,
      shouldStop: () => n >= 2,
      fetchChunk: async () => {
        n++;
        return [];
      },
    });
    expect(res).toMatchObject({ stoppedBy: 'time', lastScanned: 2100 });
  });

  it('returns lastScanned = fromBlock - 1 when nothing could be scanned', async () => {
    const res = await scanRange({ ...opts, fromBlock: 50, toBlock: 49, fetchChunk: async () => [] });
    expect(res).toMatchObject({ stoppedBy: 'done', lastScanned: 49 });
  });
});
