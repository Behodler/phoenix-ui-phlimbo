/**
 * Pure helpers for PauserV2's `health()` view and its skip/failure events.
 *
 * Kept free of React and wagmi so the Safety tab, the Admin Pauser panel and the
 * unit tests all share exactly one implementation of the coverage arithmetic and
 * the receipt parsing.
 */
import { decodeErrorResult, isAddressEqual, parseEventLogs, type Hex, type Log } from 'viem';
import { pauserAbi, skipReasonLabel } from './pauserAbi';

export type Address = `0x${string}`;

/** Problem categories surfaced to users. `noPausedGetter` is deliberately absent: it is informational. */
export type PauserProblemCategory = 'notPauser' | 'alreadyPaused' | 'unreachable';

export interface PauserHealthLists {
  notPauser: readonly Address[];
  alreadyPaused: readonly Address[];
  noPausedGetter: readonly Address[];
  unreachable: readonly Address[];
}

export interface PauserCoverage {
  /** M: number of registered contracts (`getPausableContracts().length`). */
  registered: number;
  /** N: registered contracts the global pause is expected to reach. */
  reachable: number;
  /** De-duplicated problem addresses (union of notPauser, alreadyPaused, unreachable) that are registered. */
  problems: Address[];
  healthy: boolean;
}

const lower = (a: string) => a.toLowerCase();

const isAddressArray = (v: unknown): v is readonly Address[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x));

/**
 * Normalise a raw `health()` result. Returns null for anything that is not four
 * address arrays, which callers treat as "V2 absent".
 */
export function normaliseHealth(raw: unknown): PauserHealthLists | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const [notPauser, alreadyPaused, noPausedGetter, unreachable] = raw;
  if (![notPauser, alreadyPaused, noPausedGetter, unreachable].every(isAddressArray)) return null;
  return { notPauser, alreadyPaused, noPausedGetter, unreachable } as PauserHealthLists;
}

/**
 * Coverage arithmetic from the story spec:
 *   M = |registered|
 *   problems = (notPauser ∪ alreadyPaused ∪ unreachable), de-duplicated by address
 *   N = M − |problems ∩ registered|
 * `noPausedGetter` never counts against N.
 */
export function computeCoverage(health: PauserHealthLists, registered: readonly Address[]): PauserCoverage {
  const registeredSet = new Set(registered.map(lower));
  const seen = new Set<string>();
  const problems: Address[] = [];
  for (const a of [...health.notPauser, ...health.alreadyPaused, ...health.unreachable]) {
    const k = lower(a);
    if (seen.has(k) || !registeredSet.has(k)) continue;
    seen.add(k);
    problems.push(a);
  }
  const m = registeredSet.size;
  return { registered: m, reachable: m - problems.length, problems, healthy: problems.length === 0 };
}

/** Problem addresses grouped by category, each de-duplicated within itself. Empty groups are omitted. */
export function groupProblems(
  health: PauserHealthLists,
): { category: PauserProblemCategory; addresses: Address[] }[] {
  const categories: PauserProblemCategory[] = ['notPauser', 'alreadyPaused', 'unreachable'];
  return categories
    .map((category) => {
      const seen = new Set<string>();
      const addresses = health[category].filter((a) => {
        const k = lower(a);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { category, addresses };
    })
    .filter((g) => g.addresses.length > 0);
}

export const PROBLEM_CATEGORY_COPY: Record<PauserProblemCategory | 'noPausedGetter', { title: string; description: string }> = {
  notPauser: { title: 'Not pauser', description: 'The contract no longer accepts this Pauser.' },
  alreadyPaused: {
    title: 'Already paused',
    description: 'Paused outside the global stop; the global pause would skip it.',
  },
  unreachable: { title: 'Unreachable', description: 'The pre-check call failed.' },
  noPausedGetter: {
    title: 'No paused() getter (informational)',
    description: 'Cannot report pause state, so it is not pre-checked. Not a problem.',
  },
};

// ---------------------------------------------------------------------------
// Receipt parsing
// ---------------------------------------------------------------------------

export type PauserTxRow =
  | { address: Address; outcome: 'skipped'; reason: number; reasonName: string; reasonLabel: string }
  | { address: Address; outcome: 'failed'; revertData: Hex; revertReason: string };

/**
 * Decode the raw revert data carried by `UnpauseFailed`. Standard `Error(string)`
 * and `Panic(uint256)` decode to their message; anything else is shown by
 * selector (custom error) or as raw hex.
 */
export function decodeRevertReason(data: Hex): string {
  if (!data || data === '0x') return 'Empty revert (no reason)';
  try {
    const decoded = decodeErrorResult({ abi: [], data });
    if (decoded.errorName === 'Error') return String(decoded.args?.[0] ?? '');
    if (decoded.errorName === 'Panic') return `Panic(${String(decoded.args?.[0] ?? '')})`;
  } catch {
    // fall through: not a standard error
  }
  if (data.length >= 10) {
    return data.length === 10 ? `Custom error ${data}` : `Custom error ${data.slice(0, 10)} (${data})`;
  }
  return data;
}

/**
 * Extract per-contract results from a Pauser `pause()` / `unpause()` receipt.
 * Only logs emitted by `pauserAddress` count; anything else in the receipt is ignored.
 */
export function parsePauserTxLogs(
  logs: readonly Log[],
  pauserAddress: Address,
  kind: 'pause' | 'unpause',
): PauserTxRow[] {
  const ours = logs.filter((l) => l.address && isAddressEqual(l.address as Address, pauserAddress));
  const eventName = kind === 'unpause' ? (['UnpauseSkipped', 'UnpauseFailed'] as const) : (['PauseSkipped'] as const);
  const parsed = parseEventLogs({ abi: pauserAbi, logs: ours as Log[], eventName: [...eventName], strict: true });
  return parsed.map((ev): PauserTxRow => {
    if (ev.eventName === 'UnpauseFailed') {
      const revertData = ev.args.reason as Hex;
      return { address: ev.args.c as Address, outcome: 'failed', revertData, revertReason: decodeRevertReason(revertData) };
    }
    const reason = Number(ev.args.reason);
    const { name, label } = skipReasonLabel(reason);
    return { address: ev.args.c as Address, outcome: 'skipped', reason, reasonName: name, reasonLabel: label };
  });
}

/** Reverse lookup: address → known contract name from the addresses map. */
export function buildAddressNameMap(addresses: object | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!addresses) return map;
  for (const [name, value] of Object.entries(addresses)) {
    if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) continue;
    if (/^0x0{40}$/.test(value)) continue;
    const k = lower(value);
    if (!map.has(k)) map.set(k, name);
  }
  return map;
}

export const shortenAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
