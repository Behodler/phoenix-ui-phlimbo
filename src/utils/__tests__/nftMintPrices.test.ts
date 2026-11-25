import { describe, it, expect } from 'vitest';
import {
  buildSnapshot,
  buildStableTokenDecimals,
  groupPricesByIndex,
  mergeMintEntries,
  normaliseEntryUsd,
  parseClaimMintedLogs,
  serialiseSnapshot,
  isSnapshotPopulated,
  snapshotMatches,
  stripRecipient,
} from '../nftMintPrices';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
const ALICE = '0x00000000000000000000000000000000000000AA';
const BOB = '0x00000000000000000000000000000000000000bb';

describe('buildStableTokenDecimals', () => {
  it('maps USDC → 6 and USDS → 18, lowercased', () => {
    const m = buildStableTokenDecimals({ USDC, USDS });
    expect(m.get(USDC.toLowerCase())).toBe(6);
    expect(m.get(USDS.toLowerCase())).toBe(18);
  });

  it('skips zero and missing addresses', () => {
    const m = buildStableTokenDecimals({ USDC: '0x0000000000000000000000000000000000000000' });
    expect(m.size).toBe(0);
    expect(buildStableTokenDecimals(null).size).toBe(0);
  });
});

describe('normaliseEntryUsd', () => {
  const stables = buildStableTokenDecimals({ USDC, USDS });

  it('USDC 6 dp', () => {
    expect(normaliseEntryUsd({ token: USDC, pricePaid: '10500000' }, stables)).toBe(10.5);
  });

  it('USDS 18 dp without precision loss', () => {
    expect(
      normaliseEntryUsd({ token: USDS.toLowerCase(), pricePaid: '12345678901234567890' }, stables),
    ).toBeCloseTo(12.345678901234567, 12);
  });

  it('unknown token → null', () => {
    expect(normaliseEntryUsd({ token: BOB, pricePaid: '1' }, stables)).toBeNull();
  });

  it('zero / garbage price → null', () => {
    expect(normaliseEntryUsd({ token: USDC, pricePaid: '0' }, stables)).toBeNull();
    expect(normaliseEntryUsd({ token: USDC, pricePaid: 'abc' }, stables)).toBeNull();
  });
});

describe('parseClaimMintedLogs', () => {
  it('lowercases addresses, keeps position, drops malformed logs', () => {
    const parsed = parseClaimMintedLogs([
      {
        args: { recipient: ALICE, dispatcherIndex: 4n, token: USDC, pricePaid: 10_000_000n },
        blockNumber: 100n,
        logIndex: 3,
      },
      { args: { recipient: ALICE, dispatcherIndex: 4n } },
      { blockNumber: 1n },
    ]);
    expect(parsed).toEqual([
      {
        recipient: ALICE.toLowerCase(),
        index: 4,
        token: USDC.toLowerCase(),
        pricePaid: '10000000',
        blockNumber: 100,
        logIndex: 3,
      },
    ]);
    expect(stripRecipient(parsed[0])).not.toHaveProperty('recipient');
  });
});

describe('mergeMintEntries', () => {
  it('dedupes by (blockNumber, logIndex) and keeps positionless entries', () => {
    const blob = [
      { index: 1, token: 'a', pricePaid: '1' },
      { index: 1, token: 'a', pricePaid: '1' },
    ];
    const cached = [{ index: 2, token: 'a', pricePaid: '2', blockNumber: 10, logIndex: 0 }];
    const tail = [
      { index: 2, token: 'a', pricePaid: '2', blockNumber: 10, logIndex: 0 },
      { index: 2, token: 'a', pricePaid: '3', blockNumber: 10, logIndex: 1 },
    ];
    expect(mergeMintEntries(blob, cached, tail)).toHaveLength(4);
  });
});

describe('groupPricesByIndex', () => {
  it('groups per dispatcher index', () => {
    const stables = buildStableTokenDecimals({ USDC, USDS });
    const m = groupPricesByIndex(
      [
        { index: 4, token: USDC.toLowerCase(), pricePaid: '10000000' },
        { index: 7, token: USDC.toLowerCase(), pricePaid: '20000000' },
        { index: 4, token: USDC.toLowerCase(), pricePaid: '11000000' },
      ],
      stables,
    );
    expect(m.get(4)).toEqual([10, 11]);
    expect(m.get(7)).toEqual([20]);
  });
});

describe('snapshot serialisation', () => {
  const entries = [
    { recipient: BOB.toLowerCase(), index: 4, token: 'u', pricePaid: '2', blockNumber: 20, logIndex: 1 },
    { recipient: ALICE.toLowerCase(), index: 2, token: 'u', pricePaid: '1', blockNumber: 30, logIndex: 0 },
    { recipient: BOB.toLowerCase(), index: 4, token: 'u', pricePaid: '1', blockNumber: 20, logIndex: 0 },
  ];

  it('is deterministic regardless of input order', () => {
    const a = serialiseSnapshot(
      buildSnapshot({ chainId: 1, minter: USDC, fromBlock: 1, snapshotBlock: 50, entries }),
    );
    const b = serialiseSnapshot(
      buildSnapshot({ chainId: 1, minter: USDC, fromBlock: 1, snapshotBlock: 50, entries: [...entries].reverse() }),
    );
    expect(a).toBe(b);
    expect(a.endsWith('}\n')).toBe(true);
    const parsed = JSON.parse(a);
    expect(Object.keys(parsed.users)).toEqual([ALICE.toLowerCase(), BOB.toLowerCase()]);
    expect(parsed.users[BOB.toLowerCase()].map((e: { pricePaid: string }) => e.pricePaid)).toEqual(['1', '2']);
    expect(parsed.users[BOB.toLowerCase()][0]).toEqual({ index: 4, token: 'u', pricePaid: '1' });
    expect(parsed.minter).toBe(USDC.toLowerCase());
  });

  it('isSnapshotPopulated rejects the empty bootstrap blob', () => {
    expect(isSnapshotPopulated({ fromBlock: 24_923_934, snapshotBlock: 24_923_933 })).toBe(false);
    expect(isSnapshotPopulated({ fromBlock: 24_923_934, snapshotBlock: 24_923_934 })).toBe(true);
    expect(isSnapshotPopulated({ fromBlock: 24_923_934, snapshotBlock: 25_000_000 })).toBe(true);
    expect(isSnapshotPopulated(null)).toBe(false);
  });

  it('snapshotMatches checks chain and minter (case-insensitive)', () => {
    const snap = { chainId: 1, minter: USDC.toLowerCase() };
    expect(snapshotMatches(snap, 1, USDC)).toBe(true);
    expect(snapshotMatches(snap, 11155111, USDC)).toBe(false);
    expect(snapshotMatches(snap, 1, USDS)).toBe(false);
    expect(snapshotMatches(snap, 1, undefined)).toBe(false);
  });
});
