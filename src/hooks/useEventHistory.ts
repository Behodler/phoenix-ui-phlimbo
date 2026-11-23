import { useQuery } from '@tanstack/react-query';

/**
 * Root-relative so it resolves on every host CloudFront serves the UI from
 * (phoenixdefi.app, *.phoenixdefi.app, phusd.behodler.io). Under `yarn dev` the
 * vite proxy forwards it to the live mainnet file (see docs/HISTORY_DATA.md).
 */
export const EVENT_HISTORY_URL = '/history.json';

/** One query key, so every Recent… section shares a single fetch. */
export const EVENT_HISTORY_QUERY_KEY = ['eventHistory'] as const;

/** The only schema version this UI understands (lambda-history/README.md). */
export const EVENT_HISTORY_VERSION = 1;

export interface HistoryTokenMeta {
  symbol: string;
  decimals: number;
}

/** Fields shared by every row. uint256 values elsewhere are decimal strings. */
interface HistoryRowBase {
  txHash: string;
  logIndex: number;
  blockNumber: number;
  /** Unix seconds. */
  timestamp: number;
}

export interface BonfireBurnRow extends HistoryRowBase {
  burner: string;
  /** NFTMinterV2 dispatcher index (the NFT type), NOT an nftStaticConfig id. */
  tokenId: string;
  /** Antimatter paid out, 18 dp. */
  payout: string;
}

export interface AnnihilationRow extends HistoryRowBase {
  user: string;
  /** 'boost' = via AntimatterBooster; `user` is the booster's caller, not the booster. */
  source: 'forge' | 'stake' | 'boost';
  stable: string;
  /** Antimatter burned, 18 dp. */
  amount: string;
  /** In the stable's own decimals (see `tokens`). */
  stableAmount: string;
  /** phUSD delivered by Antimatter, 18 dp. For boost rows this is the base, excluding `bonusPhUSD`. */
  phUSDAmount: string;
  /** Boost rows only: extra phUSD minted by AntimatterBooster, 18 dp. Absent if unpaired. */
  bonusPhUSD?: string;
}

export interface BatchMintRow extends HistoryRowBase {
  recipient: string;
  payer: string;
  free: string;
  paid: string;
  /** USDS (the payment token), 18 dp. */
  paidCost: string;
  potReservedUSDC: string;
  owedAdded: string;
}

/** `history.json` schema v1. Arrays are ascending by (blockNumber, logIndex). */
export interface EventHistory {
  version: 1;
  chainId: number;
  generatedAt: string;
  tokens: Record<string, HistoryTokenMeta>;
  bonfireBurns: BonfireBurnRow[];
  annihilations: AnnihilationRow[];
  batchMints: BatchMintRow[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Accepts a parsed document only if it is schema v1 with the expected
 * top-level shape; anything else is `null` (a newer or broken file must not
 * render half-understood numbers).
 */
export function parseEventHistory(json: unknown): EventHistory | null {
  if (!isRecord(json)) return null;
  if (json.version !== EVENT_HISTORY_VERSION) return null;
  if (typeof json.generatedAt !== 'string') return null;
  if (!isRecord(json.tokens)) return null;
  if (!Array.isArray(json.bonfireBurns) || !Array.isArray(json.annihilations) || !Array.isArray(json.batchMints)) {
    return null;
  }
  return json as unknown as EventHistory;
}

/**
 * Fetches and validates `/history.json`.
 *
 * Network and HTTP failures throw, so react-query retries once. A response
 * that arrives but is not valid v1 JSON resolves to `null` straight away:
 * retrying would only fetch the same bad document again.
 */
export async function fetchEventHistory(): Promise<EventHistory | null> {
  const response = await fetch(EVENT_HISTORY_URL, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`history.json returned ${response.status}: ${response.statusText}`);
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return null;
  }
  return parseEventHistory(json);
}

export interface UseEventHistoryResult {
  /** The parsed history, or `null` while loading / on any failure. */
  history: EventHistory | null;
  isLoading: boolean;
  /** True once the fetch has settled without a usable v1 document. */
  isUnavailable: boolean;
}

/**
 * Mainnet activity history (Bonfire burns, annihilations, discount batch
 * mints) from the static `history.json` the phusd-history-indexer Lambda
 * publishes. Chain-independent and wallet-free: it is always mainnet data.
 *
 * The file is rewritten every 12 h and cached for 5 min, so one fetch per
 * ~5 minutes is plenty and window-focus refetches are off.
 */
export function useEventHistory(): UseEventHistoryResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: EVENT_HISTORY_QUERY_KEY,
    queryFn: fetchEventHistory,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const history = isError ? null : (data ?? null);
  return { history, isLoading, isUnavailable: !isLoading && history === null };
}

export default useEventHistory;
