// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  annihilationRows,
  assertValidDoc,
  batchMintRow,
  burnRow,
  emptyDoc,
  mergeRows,
  stringifyDoc,
  toDecString,
} from '../lib/history.mjs';

const STAKER = '0xA6d3fc83C91B8319D219cEB12B46e3dfF064B58F';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ALICE = '0x1111111111111111111111111111111111111111';
const BOB = '0x2222222222222222222222222222222222222222';
const TX1 = '0x' + 'a'.repeat(64);
const TX2 = '0x' + 'b'.repeat(64);

const annLog = ({ tx, logIndex, block = 100, annihilator }) => ({
  transactionHash: tx,
  logIndex,
  blockNumber: BigInt(block),
  args: {
    stable: USDC.toLowerCase(),
    annihilator,
    recipient: annihilator,
    amount: 5n * 10n ** 18n,
    stableAmount: 5_000_000n,
    phUSDAmount: 10n * 10n ** 18n,
  },
});
const autoLog = ({ tx, logIndex, user }) => ({
  transactionHash: tx,
  logIndex,
  blockNumber: 100n,
  args: { token: USDC, user },
});
const ts = new Map([[100, 1_700_000_000]]);

describe('bigint serialization', () => {
  it('converts bigints to decimal strings, including > 2^53', () => {
    expect(toDecString(123n)).toBe('123');
    expect(toDecString(2n ** 255n)).toBe('57896044618658097711785492504343953926634992332820282019728792003956564819968');
    expect(stringifyDoc({ a: 10n ** 30n, b: 1 })).toBe('{\n  "a": "1000000000000000000000000000000",\n  "b": 1\n}');
  });

  it('builds rows with string uint256 fields and numeric block/timestamp', () => {
    const burn = burnRow(
      { transactionHash: TX1, logIndex: 3, blockNumber: 100n, args: { burner: ALICE, tokenId: 2n, payout: 10n ** 21n } },
      1_700_000_000,
    );
    expect(burn).toEqual({
      txHash: TX1,
      logIndex: 3,
      blockNumber: 100,
      timestamp: 1_700_000_000,
      burner: ALICE,
      tokenId: '2',
      payout: '1000000000000000000000',
    });
    const mint = batchMintRow(
      {
        transactionHash: TX2,
        logIndex: 0,
        blockNumber: 101n,
        args: { recipient: ALICE, free: 1n, paid: 9n, paidCost: 900_000_000n, potReservedUSDC: 5n, owedAdded: 0n },
      },
      1,
      BOB.toLowerCase(),
    );
    expect(mint.payer).toBe(BOB);
    expect(mint.paidCost).toBe('900000000');
    expect(typeof mint.blockNumber).toBe('number');
  });
});

describe('mergeRows', () => {
  const r = (tx, logIndex, blockNumber) => ({ txHash: tx, logIndex, blockNumber });

  it('dedupes by txHash:logIndex (case-insensitive) and sorts by (block, logIndex)', () => {
    const existing = [r(TX1, 2, 100)];
    const incoming = [r(TX2, 0, 101), r(TX1.toUpperCase().replace('0X', '0x'), 2, 100), r(TX1, 1, 100)];
    const { rows, added } = mergeRows(existing, incoming);
    expect(added).toBe(2);
    expect(rows.map((x) => `${x.blockNumber}:${x.logIndex}`)).toEqual(['100:1', '100:2', '101:0']);
  });

  it('is idempotent: re-merging the same rows adds nothing and keeps counts', () => {
    const first = mergeRows([], [r(TX1, 0, 1), r(TX2, 0, 2)]);
    const second = mergeRows(first.rows, [r(TX1, 0, 1), r(TX2, 0, 2)]);
    expect(second.added).toBe(0);
    expect(second.rows).toEqual(first.rows);
  });

  it('keeps the existing row when a duplicate arrives', () => {
    const existing = [{ ...r(TX1, 0, 1), marker: 'old' }];
    const { rows } = mergeRows(existing, [{ ...r(TX1, 0, 1), marker: 'new' }]);
    expect(rows[0].marker).toBe('old');
  });
});

describe('annihilation re-attribution', () => {
  it('marks direct calls as forge with user = annihilator', () => {
    const [row] = annihilationRows([annLog({ tx: TX1, logIndex: 4, annihilator: ALICE })], [], STAKER, ts);
    expect(row).toMatchObject({ source: 'forge', user: ALICE, stable: USDC, amount: '5000000000000000000', stableAmount: '5000000', timestamp: 1_700_000_000 });
  });

  it('re-attributes StableStakerV2 annihilations to AutoAnnihilated.user in the same tx', () => {
    const rows = annihilationRows(
      [annLog({ tx: TX1, logIndex: 4, annihilator: STAKER.toLowerCase() }), annLog({ tx: TX2, logIndex: 1, annihilator: ALICE })],
      [autoLog({ tx: TX1, logIndex: 6, user: BOB }), autoLog({ tx: TX2, logIndex: 9, user: STAKER })],
      STAKER,
      ts,
    );
    const byTx = Object.fromEntries(rows.map((x) => [x.txHash, x]));
    expect(byTx[TX1]).toMatchObject({ source: 'stake', user: BOB });
    expect(byTx[TX2]).toMatchObject({ source: 'forge', user: ALICE });
  });

  it('pairs multiple stake annihilations in one tx by logIndex order', () => {
    const rows = annihilationRows(
      [annLog({ tx: TX1, logIndex: 10, annihilator: STAKER }), annLog({ tx: TX1, logIndex: 2, annihilator: STAKER })],
      [autoLog({ tx: TX1, logIndex: 12, user: BOB }), autoLog({ tx: TX1, logIndex: 4, user: ALICE })],
      STAKER,
      ts,
    );
    expect(rows.map((x) => [x.logIndex, x.user])).toEqual([
      [2, ALICE],
      [10, BOB],
    ]);
  });

  it('falls back to user = StableStakerV2 with a warning when AutoAnnihilated is missing', () => {
    const warn = vi.fn();
    const [row] = annihilationRows([annLog({ tx: TX1, logIndex: 4, annihilator: STAKER })], [], STAKER, ts, warn);
    expect(row).toMatchObject({ source: 'stake', user: STAKER });
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('document validation', () => {
  const opts = { chainId: 1, version: 1 };
  const doc = emptyDoc({ ...opts, deployBlocks: { bonfire: 10, antimatter: 20, stableStaker: 30, batchMint: 40 } });

  it('starts cursors one block before each deploy block', () => {
    expect(doc.cursors).toEqual({ bonfire: 9, antimatter: 19, stableStaker: 29, batchMint: 39 });
    expect(() => assertValidDoc(doc, opts)).not.toThrow();
  });

  it('rejects malformed docs', () => {
    expect(() => assertValidDoc(null, opts)).toThrow();
    expect(() => assertValidDoc({ ...doc, version: 2 }, opts)).toThrow();
    expect(() => assertValidDoc({ ...doc, chainId: 11155111 }, opts)).toThrow();
    expect(() => assertValidDoc({ ...doc, annihilations: {} }, opts)).toThrow();
    expect(() => assertValidDoc({ ...doc, cursors: { ...doc.cursors, bonfire: '9' } }, opts)).toThrow();
  });
});
