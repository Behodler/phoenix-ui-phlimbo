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
function fakeChain() {
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

const run = (store, chain) => runIndexer({ store, chain, remainingMs: () => 600_000, log: () => {} });

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
