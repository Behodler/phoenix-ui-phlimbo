// Pure helpers for the Recent… history sections (kept out of the component
// files so they stay fast-refresh friendly and unit-testable).
import { formatUnits } from 'viem';
import type { AnnihilationRow, BatchMintRow, BonfireBurnRow, HistoryTokenMeta } from '../../../hooks/useEventHistory';

/** Rows shown when a section first opens, and added per "Show more". */
export const HISTORY_PAGE_SIZE = 5;

export const ANTIMATTER_DECIMALS = 18;
export const PHUSD_DECIMALS = 18;
/** Batch mints are paid in USDS (18 dp); only the discount pot is USDC. */
export const BATCH_MINT_PAYMENT_DECIMALS = 18;

/** Antimatter purple, as used by the Forge Annihilate row metric. */
export const ANTIMATTER_COLOR = '#C4AEEA';
/** Bonfire pot yellow, as used by the Forge Bonfire row metric (`BonfirePotMetric`). */
export const BONFIRE_COLOR = '#FFD93D';
/** "Free" green on the batch-mint section. */
export const FREE_GREEN = '#7FD8A8';

/** A uint256 decimal string as bigint; anything unparsable counts as 0. */
export function toBigInt(raw: string | number | undefined | null): bigint {
  if (raw === undefined || raw === null) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

/** Sum of uint256 decimal strings, in bigint (never through Number). */
export function sumRaw(values: readonly (string | undefined)[]): bigint {
  return values.reduce<bigint>((acc, v) => acc + toBigInt(v), 0n);
}

/**
 * A raw token amount at `decimals`, as a 2 dp en-US string ("1,240.00").
 * The raw string goes through viem `formatUnits` first, so precision is only
 * lost at the final 2 dp display step.
 */
export function formatTokenAmount(raw: string | bigint, decimals: number): string {
  const value = typeof raw === 'bigint' ? raw : toBigInt(raw);
  return Number(formatUnits(value, decimals)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Integer counts with thousands separators. */
export function formatCount(n: number | bigint): string {
  return typeof n === 'bigint' ? n.toLocaleString('en-US') : Math.round(n).toLocaleString('en-US');
}

/** "just now", "12m ago", "2h ago", "3d ago" relative to `nowMs`. */
export function formatAge(timestampSec: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor(nowMs / 1000 - timestampSec));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Absolute UTC time for tooltips, e.g. "2026-11-18 14:03 UTC". */
export function formatUtc(timestampSec: number): string {
  const iso = new Date(timestampSec * 1000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** "18 Nov 2026" (UTC). */
export function formatUtcDate(timestampSec: number): string {
  return new Date(timestampSec * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** `0x3f2a…a91c`. */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export const etherscanAddressUrl = (address: string) => `https://etherscan.io/address/${address}`;
export const etherscanTxUrl = (txHash: string) => `https://etherscan.io/tx/${txHash}`;

/** Newest first. The file is ascending by (blockNumber, logIndex). */
export function newestFirst<T extends { blockNumber: number; logIndex: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
}

/** Token metadata for a stable, looked up case-insensitively. */
export function tokenMetaFor(
  tokens: Record<string, HistoryTokenMeta>,
  stable: string
): HistoryTokenMeta | undefined {
  return tokens[stable.toLowerCase()];
}

// ── Annihilations ────────────────────────────────────────────────────────────

export interface AnnihilationSummary {
  count: number;
  /** Rows that are neither Stake nor Boost. */
  viaForge: number;
  viaStake: number;
  viaBoost: number;
  antimatterRaw: bigint;
  /** Total phUSD received: base `phUSDAmount` plus any boost `bonusPhUSD`. */
  phUSDRaw: bigint;
  /** Sum of boost `bonusPhUSD` (a missing value counts as 0). */
  bonusRaw: bigint;
}

/** phUSD a row's recipient received: base plus any boost bonus, raw 18 dp. */
export function annihilationPhUSDOut(row: Pick<AnnihilationRow, 'phUSDAmount' | 'bonusPhUSD'>): bigint {
  return sumRaw([row.phUSDAmount, row.bonusPhUSD]);
}

export function summarizeAnnihilations(rows: readonly AnnihilationRow[]): AnnihilationSummary {
  const bonusRaw = sumRaw(rows.map((r) => r.bonusPhUSD));
  return {
    count: rows.length,
    viaForge: rows.filter((r) => r.source !== 'stake' && r.source !== 'boost').length,
    viaStake: rows.filter((r) => r.source === 'stake').length,
    viaBoost: rows.filter((r) => r.source === 'boost').length,
    antimatterRaw: sumRaw(rows.map((r) => r.amount)),
    phUSDRaw: sumRaw(rows.map((r) => r.phUSDAmount)) + bonusRaw,
    bonusRaw,
  };
}

/**
 * The "+ Stablecoin" cell: amount at the stable's decimals plus its symbol.
 * A stable missing from `tokens` hides the amount and shows the shortened
 * token address instead.
 */
export function formatStable(
  tokens: Record<string, HistoryTokenMeta>,
  row: Pick<AnnihilationRow, 'stable' | 'stableAmount'>
): { amount: string | null; symbol: string } {
  const meta = tokenMetaFor(tokens, row.stable);
  if (!meta) return { amount: null, symbol: shortAddress(row.stable) };
  return { amount: formatTokenAmount(row.stableAmount, meta.decimals), symbol: meta.symbol };
}

// ── Bonfire burns ────────────────────────────────────────────────────────────

export interface BurnSummary {
  burns7d: number;
  lastPayoutRaw: bigint | null;
  totalPaidRaw: bigint;
}

const SEVEN_DAYS_SEC = 7 * 24 * 60 * 60;

export function summarizeBurns(rows: readonly BonfireBurnRow[], nowMs: number): BurnSummary {
  const cutoff = nowMs / 1000 - SEVEN_DAYS_SEC;
  const latest = newestFirst(rows)[0];
  return {
    burns7d: rows.filter((r) => r.timestamp >= cutoff).length,
    lastPayoutRaw: latest ? toBigInt(latest.payout) : null,
    totalPaidRaw: sumRaw(rows.map((r) => r.payout)),
  };
}

// ── Batch mints ──────────────────────────────────────────────────────────────

/** free / (free + paid) as a whole percent, rounded; 0 when nothing was minted. */
export function discountPercent(free: bigint, paid: bigint): number {
  const total = free + paid;
  if (total <= 0n) return 0;
  return Math.round(Number((free * 10_000n) / total) / 100);
}

export interface BatchMintSummary {
  batches: number;
  mintedTotal: bigint;
  freeTotal: bigint;
  avgDiscountPercent: number;
  /** Timestamp of the oldest batch, or null when there are none. */
  firstTimestamp: number | null;
}

export function summarizeBatchMints(rows: readonly BatchMintRow[]): BatchMintSummary {
  const freeTotal = sumRaw(rows.map((r) => r.free));
  const paidTotal = sumRaw(rows.map((r) => r.paid));
  const first = rows.reduce<number | null>((min, r) => (min === null || r.timestamp < min ? r.timestamp : min), null);
  return {
    batches: rows.length,
    mintedTotal: freeTotal + paidTotal,
    freeTotal,
    avgDiscountPercent: discountPercent(freeTotal, paidTotal),
    firstTimestamp: first,
  };
}
