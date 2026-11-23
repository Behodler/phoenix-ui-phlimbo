// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  annihilationRows,
  assertValidDoc,
  batchMintRow,
  burnRow,
  emptyDoc,
  mergeRows,
  replaceRows,
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
const boostLog = ({ tx, logIndex, user, base = 10n * 10n ** 18n, bonus = 15n * 10n ** 17n }) => ({
  transactionHash: tx,
  logIndex,
  blockNumber: 100n,
  args: {
    user,
    recipient: user,
    stable: USDC,
    amount: 5n * 10n ** 18n,
    stableAmount: 5_000_000n,
    basePhUSD: base,
    bonusPhUSD: bonus,
  },
});
const BOOSTER = '0xbb8bF9C05160bB45A2ef920AfD09Bc4ab0258a2C';
const ZERO = '0x0000000000000000000000000000000000000000';
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

describe('booster annihilation re-attribution', () => {
  const TX3 = '0x' + 'c'.repeat(64);
  const opts = (boostedLogs) => ({ boostedLogs, booster: BOOSTER });

  it('re-attributes a booster annihilation to BoostedAnnihilation.user with source boost and bonusPhUSD', () => {
    const warn = vi.fn();
    const [row] = annihilationRows(
      [annLog({ tx: TX1, logIndex: 4, annihilator: BOOSTER.toLowerCase() })],
      [],
      STAKER,
      ts,
      warn,
      opts([boostLog({ tx: TX1, logIndex: 8, user: ALICE })]),
    );
    expect(row).toEqual({
      txHash: TX1,
      logIndex: 4,
      blockNumber: 100,
      timestamp: 1_700_000_000,
      user: ALICE,
      source: 'boost',
      stable: USDC,
      amount: '5000000000000000000',
      stableAmount: '5000000',
      phUSDAmount: '10000000000000000000',
      bonusPhUSD: '1500000000000000000',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('pairs multiple boosts in one tx by logIndex order', () => {
    const rows = annihilationRows(
      [annLog({ tx: TX1, logIndex: 10, annihilator: BOOSTER }), annLog({ tx: TX1, logIndex: 2, annihilator: BOOSTER })],
      [],
      STAKER,
      ts,
      undefined,
      opts([boostLog({ tx: TX1, logIndex: 14, user: BOB, bonus: 2n }), boostLog({ tx: TX1, logIndex: 5, user: ALICE, bonus: 1n })]),
    );
    expect(rows.map((x) => [x.logIndex, x.user, x.bonusPhUSD])).toEqual([
      [2, ALICE, '1'],
      [10, BOB, '2'],
    ]);
  });

  it('keeps user = booster, source boost, no bonusPhUSD and warns when BoostedAnnihilation is missing', () => {
    const warn = vi.fn();
    const [row] = annihilationRows([annLog({ tx: TX1, logIndex: 4, annihilator: BOOSTER })], [], STAKER, ts, warn, opts([]));
    expect(row).toMatchObject({ source: 'boost', user: BOOSTER });
    expect(row).not.toHaveProperty('bonusPhUSD');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns on a basePhUSD mismatch but keeps the Annihilated phUSDAmount', () => {
    const warn = vi.fn();
    const [row] = annihilationRows(
      [annLog({ tx: TX1, logIndex: 4, annihilator: BOOSTER })],
      [],
      STAKER,
      ts,
      warn,
      opts([boostLog({ tx: TX1, logIndex: 8, user: ALICE, base: 9n * 10n ** 18n })]),
    );
    expect(row).toMatchObject({ source: 'boost', user: ALICE, phUSDAmount: '10000000000000000000', bonusPhUSD: '1500000000000000000' });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/basePhUSD/);
  });

  it('handles forge, stake and boost rows mixed in one batch', () => {
    const warn = vi.fn();
    const rows = annihilationRows(
      [
        annLog({ tx: TX1, logIndex: 1, annihilator: ALICE }),
        annLog({ tx: TX2, logIndex: 1, annihilator: STAKER }),
        annLog({ tx: TX3, logIndex: 1, annihilator: BOOSTER }),
      ],
      [autoLog({ tx: TX2, logIndex: 3, user: BOB })],
      STAKER,
      ts,
      warn,
      opts([boostLog({ tx: TX3, logIndex: 3, user: BOB, bonus: 7n })]),
    );
    const byTx = Object.fromEntries(rows.map((x) => [x.txHash, x]));
    expect(byTx[TX1]).toMatchObject({ source: 'forge', user: ALICE });
    expect(byTx[TX1]).not.toHaveProperty('bonusPhUSD');
    expect(byTx[TX2]).toMatchObject({ source: 'stake', user: BOB });
    expect(byTx[TX2]).not.toHaveProperty('bonusPhUSD');
    expect(byTx[TX3]).toMatchObject({ source: 'boost', user: BOB, bonusPhUSD: '7' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('with a zero (or absent) booster address, output is identical to the legacy call', () => {
    const anns = [annLog({ tx: TX1, logIndex: 4, annihilator: BOOSTER }), annLog({ tx: TX2, logIndex: 1, annihilator: STAKER })];
    const autos = [autoLog({ tx: TX2, logIndex: 3, user: BOB })];
    const legacy = annihilationRows(anns, autos, STAKER, ts);
    const zero = annihilationRows(anns, autos, STAKER, ts, undefined, { boostedLogs: [boostLog({ tx: TX1, logIndex: 8, user: ALICE })], booster: ZERO });
    expect(zero).toEqual(legacy);
    expect(legacy.find((x) => x.txHash === TX1)).toMatchObject({ source: 'forge', user: BOOSTER });
  });
});

describe('replaceRows', () => {
  const r = (tx, logIndex, extra = {}) => ({ txHash: tx, logIndex, blockNumber: 1, ...extra });

  it('replaces matching keys in place, counts only real changes, never adds or removes', () => {
    const existing = [r(TX1, 0, { user: 'a' }), r(TX2, 0, { user: 'b' })];
    const { rows, replaced } = replaceRows(existing, [r(TX1, 0, { user: 'z' }), r(TX2, 0, { user: 'b' }), r(TX2, 9, { user: 'new' })]);
    expect(replaced).toBe(1);
    expect(rows).toEqual([r(TX1, 0, { user: 'z' }), r(TX2, 0, { user: 'b' })]);
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
