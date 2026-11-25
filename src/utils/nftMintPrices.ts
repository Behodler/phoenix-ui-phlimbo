/**
 * Pure helpers for the per-user NFT cost basis (story 105).
 *
 * NFTMinterV2 emits, on every paid mint:
 *   `ClaimMinted(address indexed recipient, uint256 indexed dispatcherIndex,
 *                address indexed token, uint256 pricePaid)`
 * `pricePaid` is the authoritative price, so the growth schedule is never
 * replayed (`setPrice` can move the price off-schedule).
 *
 * Shared by `useUserMintPrices` (browser) and `scripts/snapshot-mint-prices.ts`
 * (snapshot generator), so the committed blob and the live tail go through the
 * same parser, normaliser and serialiser. Nothing here touches the DOM, React
 * or the network.
 */
import { formatUnits } from 'viem';

/** Mainnet NFTMinterV2 deploy block (tx 0xb8d14a5b…3231, DeployMainnetNFTV2.s.sol). */
export const MAINNET_NFT_MINTER_DEPLOY_BLOCK = 24_923_934;

/** Blocks a log must be buried under before it is written to the cache. */
export const CONFIRMATION_BLOCKS = 12;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * One `ClaimMinted` log for a known recipient, kept raw: the price stays a
 * decimal uint string in the payment token's own units, and the token is kept
 * so it can be resolved per log (dispatchers were swapped at several indices,
 * and EYE/SCX/Flax were not paid in USDC before story 075).
 *
 * `blockNumber` / `logIndex` are present on live and cached entries (used to
 * dedupe and to order), and absent on snapshot-blob entries.
 */
export interface RawMintEntry {
  index: number;
  /** Payment token, lowercase. */
  token: string;
  /** Raw `pricePaid` as a decimal uint string. */
  pricePaid: string;
  blockNumber?: number;
  logIndex?: number;
}

/** A raw entry that still carries its recipient (generator input). */
export interface RecipientMintEntry extends RawMintEntry {
  /** Lowercase recipient. */
  recipient: string;
}

/** Committed snapshot shape (`src/data/nftMintPriceSnapshot.mainnet.json`). */
export interface MintPriceSnapshot {
  chainId: number;
  /** NFTMinter address, lowercase. */
  minter: string;
  fromBlock: number;
  snapshotBlock: number;
  users: Record<string, RawMintEntry[]>;
}

/** Minimal structural view of a viem `ClaimMinted` log. */
export interface ClaimMintedLogLike {
  args?: {
    recipient?: string;
    dispatcherIndex?: bigint;
    token?: string;
    pricePaid?: bigint;
  };
  blockNumber?: bigint | null;
  logIndex?: number | null;
}

/**
 * Turn decoded `ClaimMinted` logs into raw entries. Logs missing any of the
 * four event args are dropped (a malformed log cannot be priced).
 */
export function parseClaimMintedLogs(logs: readonly ClaimMintedLogLike[]): RecipientMintEntry[] {
  const out: RecipientMintEntry[] = [];
  for (const log of logs) {
    const a = log.args;
    if (
      !a ||
      typeof a.recipient !== 'string' ||
      typeof a.dispatcherIndex !== 'bigint' ||
      typeof a.token !== 'string' ||
      typeof a.pricePaid !== 'bigint'
    ) {
      continue;
    }
    const entry: RecipientMintEntry = {
      recipient: a.recipient.toLowerCase(),
      index: Number(a.dispatcherIndex),
      token: a.token.toLowerCase(),
      pricePaid: a.pricePaid.toString(),
    };
    if (typeof log.blockNumber === 'bigint') entry.blockNumber = Number(log.blockNumber);
    if (typeof log.logIndex === 'number') entry.logIndex = log.logIndex;
    out.push(entry);
  }
  return out;
}

/** Drop the recipient, keeping the raw entry shape stored per user. */
export function stripRecipient({ recipient: _recipient, ...rest }: RecipientMintEntry): RawMintEntry {
  void _recipient;
  return rest;
}

/**
 * Lowercase token → decimals for the payment tokens treated as $1 stables.
 *
 * Only USDC (6 dp) and USDS (18 dp) from the active network's address book.
 * Zero / missing addresses are skipped, so an unwired network prices nothing.
 */
export function buildStableTokenDecimals(addresses: {
  USDC?: string | null;
  USDS?: string | null;
} | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  const add = (addr: string | null | undefined, decimals: number) => {
    if (!addr) return;
    const lc = addr.toLowerCase();
    if (lc === ZERO_ADDRESS) return;
    map.set(lc, decimals);
  };
  add(addresses?.USDC, 6);
  add(addresses?.USDS, 18);
  return map;
}

/**
 * USD price of one raw entry, or `null` when the token is not a known $1
 * stable (e.g. a pre-075 EYE/SCX/Flax payment) or the value is unusable.
 * A `null` price is dropped from the paid list, so that unit is priced at the
 * marginal price instead (conservative).
 *
 * Keeps the value as bigint until the final conversion: `formatUnits` gives an
 * exact decimal string, so an 18-dp USDS price never loses precision through
 * an intermediate `Number(raw)`.
 */
export function normaliseEntryUsd(
  entry: Pick<RawMintEntry, 'token' | 'pricePaid'>,
  stables: ReadonlyMap<string, number>,
): number | null {
  const decimals = stables.get(entry.token.toLowerCase());
  if (decimals === undefined) return null;
  let raw: bigint;
  try {
    raw = BigInt(entry.pricePaid);
  } catch {
    return null;
  }
  if (raw <= 0n) return null;
  const usd = Number(formatUnits(raw, decimals));
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

function entryKey(e: RawMintEntry): string | null {
  return e.blockNumber !== undefined && e.logIndex !== undefined
    ? `${e.blockNumber}:${e.logIndex}`
    : null;
}

/**
 * Concatenate entry lists (blob, cache, tail…) and dedupe by
 * `(blockNumber, logIndex)` where both are present. Entries without a position
 * (snapshot-blob entries) are never deduped against each other: the blob and
 * the scanned range never overlap, so they cannot be duplicates.
 */
export function mergeMintEntries(...lists: readonly (readonly RawMintEntry[])[]): RawMintEntry[] {
  const seen = new Set<string>();
  const out: RawMintEntry[] = [];
  for (const list of lists) {
    for (const e of list) {
      const key = entryKey(e);
      if (key !== null) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push(e);
    }
  }
  return out;
}

/** Group normalised USD prices by dispatcher index, dropping unpriceable entries. */
export function groupPricesByIndex(
  entries: readonly RawMintEntry[],
  stables: ReadonlyMap<string, number>,
): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const e of entries) {
    const usd = normaliseEntryUsd(e, stables);
    if (usd === null) continue;
    const list = out.get(e.index);
    if (list) list.push(usd);
    else out.set(e.index, [usd]);
  }
  return out;
}

function compareByPosition(a: RawMintEntry, b: RawMintEntry): number {
  const ab = a.blockNumber ?? 0;
  const bb = b.blockNumber ?? 0;
  if (ab !== bb) return ab - bb;
  return (a.logIndex ?? 0) - (b.logIndex ?? 0);
}

/**
 * Build the snapshot object from every scanned `ClaimMinted` entry.
 * Users are keyed by lowercase address in ascending order; each user's entries
 * are in chain order (block, then log index) and stored as `{index, token,
 * pricePaid}` only, so a rerun at the same block is byte-identical.
 */
export function buildSnapshot(params: {
  chainId: number;
  minter: string;
  fromBlock: number;
  snapshotBlock: number;
  entries: readonly RecipientMintEntry[];
}): MintPriceSnapshot {
  const byUser = new Map<string, RecipientMintEntry[]>();
  for (const e of params.entries) {
    const list = byUser.get(e.recipient);
    if (list) list.push(e);
    else byUser.set(e.recipient, [e]);
  }
  const users: Record<string, RawMintEntry[]> = {};
  for (const addr of [...byUser.keys()].sort()) {
    users[addr] = [...(byUser.get(addr) ?? [])]
      .sort(compareByPosition)
      .map((e) => ({ index: e.index, token: e.token, pricePaid: e.pricePaid }));
  }
  return {
    chainId: params.chainId,
    minter: params.minter.toLowerCase(),
    fromBlock: params.fromBlock,
    snapshotBlock: params.snapshotBlock,
    users,
  };
}

/** Deterministic serialisation: pretty, fixed key order, trailing newline. */
export function serialiseSnapshot(snapshot: MintPriceSnapshot): string {
  const ordered: MintPriceSnapshot = {
    chainId: snapshot.chainId,
    minter: snapshot.minter,
    fromBlock: snapshot.fromBlock,
    snapshotBlock: snapshot.snapshotBlock,
    users: Object.fromEntries(
      Object.keys(snapshot.users)
        .sort()
        .map((addr) => [
          addr,
          snapshot.users[addr].map((e) => ({ index: e.index, token: e.token, pricePaid: e.pricePaid })),
        ]),
    ),
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** True when `snapshot` was taken for this chain and this minter. */
export function snapshotMatches(
  snapshot: Pick<MintPriceSnapshot, 'chainId' | 'minter'> | null | undefined,
  chainId: number | undefined,
  minter: string | undefined,
): boolean {
  if (!snapshot || chainId === undefined || !minter) return false;
  return snapshot.chainId === chainId && snapshot.minter.toLowerCase() === minter.toLowerCase();
}
