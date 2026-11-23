// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { ANTIMATTER, BATCH_MINTER_DISCOUNT, NFT_BONFIRE, STABLE_STAKER_V2 } from '../lib/config.mjs';
import { runIndexer } from '../lib/indexer.mjs';

const ALICE = '0x1111111111111111111111111111111111111111';
const BOB = '0x2222222222222222222222222222222222222222';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const tx = (c) => '0x' + c.repeat(64);
const FINAL = BATCH_MINTER_DISCOUNT.deployBlock + 100;

// Fake chain: a fixed set of logs per address, filtered by block range.
// `extra` adds logs per address (appended to the defaults).
function fakeChain(extra = {}) {
  const logs = {
    [NFT_BONFIRE.address]: [
      { transactionHash: tx('1'), logIndex: 0, blockNumber: BigInt(NFT_BONFIRE.deployBlock + 5), args: { burner: ALICE, tokenId: 1n, payout: 7n } },
    ],
    [ANTIMATTER.address]: [
      { transactionHash: tx('2'), logIndex: 3, blockNumber: BigInt(ANTIMATTER.deployBlock + 10), args: { stable: USDC, annihilator: ALICE, recipient: ALICE, amount: 1n, stableAmount: 1n, phUSDAmount: 2n } },
      { transactionHash: tx('3'), logIndex: 7, blockNumber: BigInt(ANTIMATTER.deployBlock + 200_000), args: { stable: USDC, annihilator: STABLE_STAKER_V2.address, recipient: STABLE_STAKER_V2.address, amount: 3n, stableAmount: 3n, phUSDAmount: 6n } },
    ],
    [STABLE_STAKER_V2.address]: [
      { transactionHash: tx('3'), logIndex: 9, blockNumber: BigInt(ANTIMATTER.deployBlock + 200_000), args: { token: USDC, user: BOB } },
    ],
    [BATCH_MINTER_DISCOUNT.address]: [
      { transactionHash: tx('4'), logIndex: 1, blockNumber: BigInt(BATCH_MINTER_DISCOUNT.deployBlock + 1), args: { recipient: ALICE, free: 1n, paid: 3n, paidCost: 300n, potReservedUSDC: 0n, owedAdded: 0n } },
    ],
  };
  for (const [addr, ls] of Object.entries(extra)) logs[addr] = [...(logs[addr] ?? []), ...ls];
  return {
    finalizedBlock: vi.fn(async () => FINAL),
    getLogs: vi.fn(async ({ address, fromBlock, toBlock }) =>
      (logs[address] ?? []).filter((l) => Number(l.blockNumber) >= fromBlock && Number(l.blockNumber) <= toBlock),
    ),
    blockTimestamp: vi.fn(async (n) => 1_700_000_000 + n),
    txFrom: vi.fn(async () => BOB),
    tokenMeta: vi.fn(async () => ({ symbol: 'USDC', decimals: 6 })),
  };
}

function memStore(initial = null) {
  let doc = initial;
  return {
    read: vi.fn(async () => (doc ? JSON.parse(JSON.stringify(doc)) : null)),
    write: vi.fn(async (d) => {
      doc = JSON.parse(JSON.stringify(d));
    }),
    get: () => doc,
  };
}

const ZERO = '0x0000000000000000000000000000000000000000';
const run = (store, chain, booster) =>
  runIndexer({ store, chain, remainingMs: () => 600_000, log: () => {}, ...(booster ? { booster } : {}) });

// A non-zero test booster deployed between the existing fixtures, so the scan
// has chunks entirely before its deploy block.
const BOOSTER = { address: '0x3333333333333333333333333333333333333333', deployBlock: ANTIMATTER.deployBlock + 150_000 };
const BOOST_BLOCK = BigInt(ANTIMATTER.deployBlock + 250_000);
function boostFixtures(boosterAddress = BOOSTER.address) {
  return {
    [ANTIMATTER.address]: [
      { transactionHash: tx('5'), logIndex: 2, blockNumber: BOOST_BLOCK, args: { stable: USDC, annihilator: boosterAddress, recipient: ALICE, amount: 4n, stableAmount: 4n, phUSDAmount: 100n } },
    ],
    [boosterAddress]: [
      { transactionHash: tx('5'), logIndex: 6, blockNumber: BOOST_BLOCK, args: { user: ALICE, recipient: ALICE, stable: USDC, amount: 4n, stableAmount: 4n, basePhUSD: 100n, bonusPhUSD: 15n } },
    ],
  };
}
const boosterCalls = (chain, address = BOOSTER.address) =>
  chain.getLogs.mock.calls.map(([a]) => a).filter((a) => a.address.toLowerCase() === address.toLowerCase());

describe('runIndexer', () => {
  it('backfills from an empty bucket, re-attributes stake rows, and advances every cursor to finalized', async () => {
    const store = memStore();
    const chain = fakeChain();
    await run(store, chain);
    const doc = store.get();
    expect(doc.cursors).toEqual({ bonfire: FINAL, antimatter: FINAL, stableStaker: FINAL, batchMint: FINAL });
    expect(doc.bonfireBurns).toHaveLength(1);
    expect(doc.annihilations.map((r) => [r.source, r.user])).toEqual([
      ['forge', ALICE],
      ['stake', BOB],
    ]);
    expect(doc.batchMints[0]).toMatchObject({ payer: BOB, paid: '3' });
    expect(doc.tokens[USDC.toLowerCase()]).toEqual({ symbol: 'USDC', decimals: 6 });
  });

  it('a second run with no new blocks adds no rows and does not rewrite', async () => {
    const store = memStore();
    const chain = fakeChain();
    await run(store, chain);
    const before = store.get();
    const summary = await run(store, chain);
    expect(summary.added).toBe(0);
    expect(summary.wrote).toBe(false);
    expect(store.write).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual(before);
  });

  it('re-scanning an already-indexed range (reset cursors) does not duplicate rows', async () => {
    const store = memStore();
    const chain = fakeChain();
    await run(store, chain);
    const doc = store.get();
    const reset = { ...doc, cursors: { bonfire: 0, antimatter: 0, stableStaker: 0, batchMint: 0 } };
    const store2 = memStore(reset);
    // small ranges are fine here: the fake chain ignores chunk size
    await runIndexer({ store: store2, chain, remainingMs: () => 600_000, log: () => {}, scan: { initialChunk: 10_000_000, minChunk: 1, maxChunk: 10_000_000, reserveMs: 0 } });
    const after = store2.get();
    expect(after.bonfireBurns).toEqual(doc.bonfireBurns);
    expect(after.annihilations).toEqual(doc.annihilations);
    expect(after.batchMints).toEqual(doc.batchMints);
  });

  it('aborts without writing when the read fails for a reason other than not-found', async () => {
    const store = { read: vi.fn(async () => { throw new Error('AccessDenied'); }), write: vi.fn() };
    await expect(run(store, fakeChain())).rejects.toThrow('AccessDenied');
    expect(store.write).not.toHaveBeenCalled();
  });

  it('aborts without writing when the stored doc is malformed', async () => {
    const store = memStore({ version: 1, chainId: 1, cursors: {}, tokens: {}, bonfireBurns: [] });
    await expect(run(store, fakeChain())).rejects.toThrow();
    expect(store.write).not.toHaveBeenCalled();
  });

  it('does not advance a cursor past a range that failed to scan', async () => {
    const store = memStore();
    const chain = fakeChain();
    const realGetLogs = chain.getLogs.getMockImplementation();
    chain.getLogs.mockImplementation(async (args) => {
      if (args.address === NFT_BONFIRE.address) throw new Error('rpc down');
      return realGetLogs(args);
    });
    await run(store, chain);
    expect(store.get().cursors.bonfire).toBe(NFT_BONFIRE.deployBlock - 1);
    expect(store.get().cursors.batchMint).toBe(FINAL);
  });
});

describe('runIndexer — AntimatterBooster attribution', () => {
  it('scans BoostedAnnihilation in lockstep and attributes boost rows to the real user', async () => {
    const store = memStore();
    const chain = fakeChain(boostFixtures());
    await run(store, chain, BOOSTER);
    const doc = store.get();
    expect(doc.cursors).toEqual({ bonfire: FINAL, antimatter: FINAL, stableStaker: FINAL, batchMint: FINAL });
    expect(doc.annihilations.map((r) => [r.source, r.user, r.bonusPhUSD])).toEqual([
      ['forge', ALICE, undefined],
      ['stake', BOB, undefined],
      ['boost', ALICE, '15'],
    ]);
    expect(doc.annihilations[2].phUSDAmount).toBe('100');
  });

  it('never queries the booster when its address is zero, and two zero-address runs produce identical boost-free output', async () => {
    const store = memStore();
    const chain = fakeChain();
    await run(store, chain, { address: ZERO, deployBlock: 0 });
    expect(boosterCalls(chain, ZERO)).toHaveLength(0);
    const baseline = memStore();
    await run(baseline, fakeChain(), { address: ZERO, deployBlock: 0 });
    expect(store.get().annihilations).toEqual(baseline.get().annihilations);
    expect(store.get().annihilations.every((r) => r.source !== 'boost' && r.bonusPhUSD === undefined)).toBe(true);
  });

  it('clamps booster queries to its deploy block and skips chunks entirely before it', async () => {
    const early = {
      transactionHash: tx('6'),
      logIndex: 1,
      blockNumber: BigInt(BOOSTER.deployBlock - 1),
      args: { user: BOB, recipient: BOB, stable: USDC, amount: 1n, stableAmount: 1n, basePhUSD: 1n, bonusPhUSD: 1n },
    };
    const fixtures = boostFixtures();
    fixtures[BOOSTER.address].push(early);
    const store = memStore();
    const chain = fakeChain(fixtures);
    await run(store, chain, BOOSTER);
    const calls = boosterCalls(chain);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.fromBlock).toBeGreaterThanOrEqual(BOOSTER.deployBlock);
      expect(c.toBlock).toBeGreaterThanOrEqual(BOOSTER.deployBlock);
    }
    // the annihilations scan itself starts well before the booster deploy block
    const annCalls = chain.getLogs.mock.calls.map(([a]) => a).filter((a) => a.address === ANTIMATTER.address);
    expect(annCalls.length).toBeGreaterThan(calls.length);
  });

  it('repairs rows stored with user = booster before the address was configured, and is idempotent', async () => {
    // Run 1: booster unknown (zero) — the boosted annihilation is stored as forge / user = booster.
    const store = memStore();
    const chain = fakeChain(boostFixtures());
    await run(store, chain, { address: ZERO, deployBlock: 0 });
    const stale = store.get().annihilations.find((r) => r.txHash === tx('5'));
    expect(stale).toMatchObject({ source: 'forge', user: BOOSTER.address });
    const before = store.get();

    // Run 2: address filled in; cursors are already at finalized, so only the repair can fix it.
    chain.getLogs.mockClear();
    const s2 = await run(store, chain, BOOSTER);
    const fixed = store.get().annihilations.find((r) => r.txHash === tx('5'));
    expect(fixed).toEqual({ ...stale, source: 'boost', user: ALICE, bonusPhUSD: '15' });
    expect(s2).toMatchObject({ wrote: true, added: 0, replaced: 1 });
    expect(store.get().annihilations).toHaveLength(before.annihilations.length);
    expect(store.get().cursors).toEqual(before.cursors);
    expect(boosterCalls(chain)).toEqual([
      expect.objectContaining({ fromBlock: Number(BOOST_BLOCK), toBlock: Number(BOOST_BLOCK) }),
    ]);

    // Run 3: nothing left to repair — no booster query, no write.
    chain.getLogs.mockClear();
    const s3 = await run(store, chain, BOOSTER);
    expect(s3).toMatchObject({ wrote: false, added: 0, replaced: 0 });
    expect(boosterCalls(chain)).toHaveLength(0);
    expect(store.write).toHaveBeenCalledTimes(2);
  });

  it('a failing repair query only warns and leaves the rows untouched', async () => {
    const store = memStore();
    const chain = fakeChain(boostFixtures());
    await run(store, chain, { address: ZERO, deployBlock: 0 });
    const before = store.get();
    const realGetLogs = chain.getLogs.getMockImplementation();
    chain.getLogs.mockImplementation(async (args) => {
      if (args.address === BOOSTER.address) throw new Error('rpc down');
      return realGetLogs(args);
    });
    const logs = [];
    const summary = await runIndexer({ store, chain, remainingMs: () => 600_000, log: (m) => logs.push(m), booster: BOOSTER });
    expect(summary).toMatchObject({ wrote: false, replaced: 0 });
    expect(store.get()).toEqual(before);
    expect(logs.some((m) => /WARN \[repair\].*rpc down/.test(m))).toBe(true);
  });
});
