import { describe, it, expect } from 'vitest';
import { encodeAbiParameters, encodeErrorResult, encodeEventTopics, type Hex, type Log } from 'viem';
import { pauserAbi, skipReasonLabel, SKIP_REASONS } from './pauserAbi';
import {
  buildAddressNameMap,
  computeCoverage,
  decodeRevertReason,
  groupProblems,
  normaliseHealth,
  parsePauserTxLogs,
  type Address,
} from './pauserHealth';

const a = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const PAUSER = a(0x9999);
const OTHER = a(0x8888);

const lists = (over: Partial<Record<'notPauser' | 'alreadyPaused' | 'noPausedGetter' | 'unreachable', Address[]>> = {}) => ({
  notPauser: [],
  alreadyPaused: [],
  noPausedGetter: [],
  unreachable: [],
  ...over,
});

describe('normaliseHealth', () => {
  it('accepts four address arrays', () => {
    const h = normaliseHealth([[a(1)], [], [a(2)], []]);
    expect(h).toEqual({ notPauser: [a(1)], alreadyPaused: [], noPausedGetter: [a(2)], unreachable: [] });
  });

  it('rejects anything that is not four address arrays (V2 treated as absent)', () => {
    expect(normaliseHealth(undefined)).toBeNull();
    expect(normaliseHealth([[], [], []])).toBeNull();
    expect(normaliseHealth([[], [], [], 'x'])).toBeNull();
    expect(normaliseHealth([[1], [], [], []])).toBeNull();
    expect(normaliseHealth({ notPauser: [] })).toBeNull();
  });
});

describe('computeCoverage', () => {
  const registered = [a(1), a(2), a(3), a(4), a(5)];

  it('healthy V2: N == M', () => {
    const c = computeCoverage(lists(), registered);
    expect(c).toEqual({ registered: 5, reachable: 5, problems: [], healthy: true });
  });

  it('counts each problem category against N', () => {
    const c = computeCoverage(lists({ notPauser: [a(1)], alreadyPaused: [a(2)], unreachable: [a(3)] }), registered);
    expect(c.registered).toBe(5);
    expect(c.reachable).toBe(2);
    expect(c.healthy).toBe(false);
    expect(c.problems).toEqual([a(1), a(2), a(3)]);
  });

  it('never counts noPausedGetter as a problem', () => {
    const c = computeCoverage(lists({ noPausedGetter: [a(1), a(2)] }), registered);
    expect(c.reachable).toBe(5);
    expect(c.healthy).toBe(true);
    expect(c.problems).toEqual([]);
  });

  it('counts an address appearing in several categories once (case-insensitive)', () => {
    const upper = a(1).toUpperCase().replace('0X', '0x') as Address;
    const c = computeCoverage(lists({ notPauser: [a(1)], unreachable: [upper], alreadyPaused: [a(1)] }), registered);
    expect(c.reachable).toBe(4);
    expect(c.problems).toHaveLength(1);
  });

  it('ignores problem addresses that are not registered', () => {
    const c = computeCoverage(lists({ notPauser: [a(42)] }), registered);
    expect(c.reachable).toBe(5);
  });
});

describe('groupProblems', () => {
  it('groups by category, omits empty groups and excludes noPausedGetter', () => {
    const g = groupProblems(lists({ notPauser: [a(1), a(1)], unreachable: [a(3)], noPausedGetter: [a(4)] }));
    expect(g).toEqual([
      { category: 'notPauser', addresses: [a(1)] },
      { category: 'unreachable', addresses: [a(3)] },
    ]);
  });
});

describe('SkipReason labels', () => {
  it('matches the IPauserV2 enum order', () => {
    expect(SKIP_REASONS.map((r) => r.name)).toEqual(['NO_CODE', 'NOT_PAUSER', 'ALREADY_PAUSED', 'NOT_PAUSED', 'UNREACHABLE']);
    expect(skipReasonLabel(3).name).toBe('NOT_PAUSED');
    expect(skipReasonLabel(9).name).toBe('UNKNOWN_9');
  });
});

// ---------------------------------------------------------------------------
// Receipt parsing
// ---------------------------------------------------------------------------

function eventLog(
  address: Address,
  eventName: 'PauseSkipped' | 'UnpauseSkipped' | 'UnpauseFailed',
  c: Address,
  reason: number | Hex,
  logIndex: number,
): Log {
  const topics = encodeEventTopics({ abi: pauserAbi, eventName, args: { c } } as never) as [Hex, ...Hex[]];
  const data =
    eventName === 'UnpauseFailed'
      ? encodeAbiParameters([{ type: 'bytes' }], [reason as Hex])
      : encodeAbiParameters([{ type: 'uint8' }], [reason as number]);
  return {
    address,
    topics,
    data,
    blockHash: `0x${'1'.repeat(64)}`,
    blockNumber: 1n,
    logIndex,
    transactionHash: `0x${'2'.repeat(64)}`,
    transactionIndex: 0,
    removed: false,
  } as Log;
}

describe('parsePauserTxLogs', () => {
  const errorString = encodeErrorResult({
    abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
    errorName: 'Error',
    args: ['Flushing'],
  });

  it('turns UnpauseSkipped / UnpauseFailed into per-contract rows', () => {
    const rows = parsePauserTxLogs(
      [eventLog(PAUSER, 'UnpauseSkipped', a(1), 3, 0), eventLog(PAUSER, 'UnpauseFailed', a(2), errorString, 1)],
      PAUSER,
      'unpause',
    );
    expect(rows).toEqual([
      { address: a(1), outcome: 'skipped', reason: 3, reasonName: 'NOT_PAUSED', reasonLabel: 'Was not paused' },
      { address: a(2), outcome: 'failed', revertData: errorString, revertReason: 'Flushing' },
    ]);
  });

  it('ignores logs emitted by other addresses, and unrelated events', () => {
    const rows = parsePauserTxLogs(
      [
        eventLog(OTHER, 'UnpauseSkipped', a(1), 1, 0),
        eventLog(PAUSER, 'PauseSkipped', a(3), 2, 1),
        { ...eventLog(PAUSER, 'UnpauseSkipped', a(4), 1, 2), topics: [`0x${'3'.repeat(64)}`] } as Log,
      ],
      PAUSER,
      'unpause',
    );
    expect(rows).toEqual([]);
  });

  it('returns no rows when the receipt has no skip/fail events (all unpaused, or V1)', () => {
    expect(parsePauserTxLogs([], PAUSER, 'unpause')).toEqual([]);
  });

  it('parses PauseSkipped for pause receipts', () => {
    const rows = parsePauserTxLogs([eventLog(PAUSER, 'PauseSkipped', a(5), 2, 0)], PAUSER, 'pause');
    expect(rows).toEqual([
      { address: a(5), outcome: 'skipped', reason: 2, reasonName: 'ALREADY_PAUSED', reasonLabel: 'Already paused' },
    ]);
  });
});

describe('decodeRevertReason', () => {
  it('decodes Error(string), Panic, custom selectors and empty data', () => {
    expect(
      decodeRevertReason(
        encodeErrorResult({
          abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
          errorName: 'Error',
          args: ['nope'],
        }),
      ),
    ).toBe('nope');
    expect(decodeRevertReason('0x4e487b710000000000000000000000000000000000000000000000000000000000000011')).toBe('Panic(17)');
    expect(decodeRevertReason('0xdeadbeef')).toBe('Custom error 0xdeadbeef');
    expect(decodeRevertReason('0xdeadbeef00')).toBe('Custom error 0xdeadbeef (0xdeadbeef00)');
    expect(decodeRevertReason('0x')).toBe('Empty revert (no reason)');
  });
});

describe('buildAddressNameMap', () => {
  it('maps lower-cased addresses to their key, skipping zero and non-address values', () => {
    const m = buildAddressNameMap({ PhlimboV3: a(1), Zero: a(0), Junk: 'abc', Num: 5 });
    expect(m.get(a(1))).toBe('PhlimboV3');
    expect(m.has(a(0))).toBe(false);
    expect(m.size).toBe(1);
  });
});
