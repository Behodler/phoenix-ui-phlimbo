import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { getAbiItem } from 'viem';
import { nftMinterV2Abi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { log } from '../utils/logger';
import mainnetSnapshot from '../data/nftMintPriceSnapshot.mainnet.json';
import {
  CONFIRMATION_BLOCKS,
  MAINNET_NFT_MINTER_DEPLOY_BLOCK,
  buildStableTokenDecimals,
  isSnapshotPopulated,
  groupPricesByIndex,
  mergeMintEntries,
  parseClaimMintedLogs,
  snapshotMatches,
  stripRecipient,
  type MintPriceSnapshot,
  type RawMintEntry,
} from '../utils/nftMintPrices';

const CLAIM_MINTED = getAbiItem({ abi: nftMinterV2Abi, name: 'ClaimMinted' });

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAINNET_CHAIN_ID = 1;

/** Committed snapshots, matched on chainId + minter. Mainnet only. */
const SNAPSHOTS: readonly MintPriceSnapshot[] = [mainnetSnapshot as MintPriceSnapshot];

const STORAGE_PREFIX = 'phoenix-nft-mint-prices';

/** Persisted per (chain, minter, wallet): confirmed entries up to `lastBlock`. */
interface StoredMintPrices {
  lastBlock: number;
  entries: RawMintEntry[];
}

export function mintPriceStorageKey(chainId: number, minter: string, wallet: string): string {
  return `${STORAGE_PREFIX}:${chainId}:${minter.toLowerCase()}:${wallet.toLowerCase()}`;
}

function isRawEntry(v: unknown): v is RawMintEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.index === 'number' &&
    typeof e.token === 'string' &&
    typeof e.pricePaid === 'string' &&
    (e.blockNumber === undefined || typeof e.blockNumber === 'number') &&
    (e.logIndex === undefined || typeof e.logIndex === 'number')
  );
}

function readStorage(key: string): StoredMintPrices | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.lastBlock === 'number' &&
      Array.isArray(parsed.entries) &&
      parsed.entries.every(isRawEntry)
    ) {
      return parsed as StoredMintPrices;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, data: StoredMintPrices): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded)
  }
}

export interface UseUserMintPricesReturn {
  /** Dispatcher index → USD prices the connected wallet paid, one per paid mint. */
  pricesByIndex: Map<number, number[]>;
  isLoading: boolean;
  /**
   * True when the tail `getLogs` failed. The result then holds the blob and the
   * cache only; any units that leaves unpriced fall to the marginal price,
   * which is the conservative direction.
   */
  isUnavailable: boolean;
  refresh: () => void;
}

/**
 * Prices the connected wallet paid for each NFT type, from NFTMinterV2
 * `ClaimMinted` logs (story 105).
 *
 * Three layers, oldest first:
 * 1. **Snapshot blob** (`src/data/nftMintPriceSnapshot.mainnet.json`) — every
 *    recipient's mints up to `snapshotBlock`, imported statically. Ignored when
 *    its chainId / minter don't match the active network, in which case the scan
 *    starts at the deploy block (mainnet) or `'earliest'` (Sepolia / Anvil).
 * 2. **localStorage cache** — this wallet's confirmed entries after the blob, up
 *    to `lastBlock`.
 * 3. **Tail** — ONE `getLogs` per run, filtered on the indexed `recipient`
 *    (all dispatcher indices at once), from `max(B, lastBlock) + 1` to the head.
 *    Only entries at least {@link CONFIRMATION_BLOCKS} deep are persisted; the
 *    unconfirmed tip is refetched every run and kept in memory, so a reorg can
 *    never poison the cache.
 *
 * **Unpopulated blob guard**: a blob that matches the network but covers no
 * blocks (`snapshotBlock < fromBlock`, the bootstrap committed before the real
 * snapshot is generated) makes NO RPC call at all. Every held unit then prices
 * at the marginal price (the conservative direction) and `isUnavailable` is
 * true. Without this, each wallet's first visit would send one unchunked
 * `getLogs` from the deploy block (~1M+ blocks), which many providers reject,
 * and the failure would retry on every page load since nothing gets cached.
 *
 * Runs on mount, on wallet / chain / minter change and on `refresh()` only. It
 * is deliberately NOT on the 12 s contract-read poll: each run costs one
 * `getBlockNumber` + one `getLogs` against a visitor-facing RPC.
 */
export function useUserMintPrices(): UseUserMintPricesReturn {
  const { address: walletAddress } = useAccount();
  const chainId = useChainId();
  const { addresses } = useContractAddresses();
  const publicClient = usePublicClient();

  const [entries, setEntries] = useState<RawMintEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [nonce, setNonce] = useState(0);

  const minterRaw = addresses?.NFTMinter;
  const minter =
    minterRaw && minterRaw.toLowerCase() !== ZERO_ADDRESS
      ? (minterRaw.toLowerCase() as `0x${string}`)
      : undefined;
  const wallet = walletAddress?.toLowerCase();

  useEffect(() => {
    if (!publicClient || !wallet || !minter) {
      setEntries([]);
      setIsUnavailable(false);
      return;
    }

    let cancelled = false;

    const blob = SNAPSHOTS.find((s) => snapshotMatches(s, chainId, minter)) ?? null;
    if (blob && !isSnapshotPopulated(blob)) {
      // Bootstrap blob for this exact minter: refuse the deploy-block-wide scan.
      log.warn(
        'NFT mint price snapshot for this minter is unpopulated; skipping the log scan (run yarn snapshot:mint-prices)',
      );
      setEntries([]);
      setIsLoading(false);
      setIsUnavailable(true);
      return;
    }
    const blobEntries = blob?.users[wallet] ?? [];
    // Last block already covered before the cache / tail take over.
    const baseBlock = blob
      ? blob.snapshotBlock
      : chainId === MAINNET_CHAIN_ID
        ? MAINNET_NFT_MINTER_DEPLOY_BLOCK - 1
        : -1;

    const key = mintPriceStorageKey(chainId, minter, wallet);
    const cache = readStorage(key);
    // Cached entries at or below the blob's block are already in the blob
    // (e.g. a newer blob shipped after the cache was written): drop them.
    const cached = (cache?.entries ?? []).filter(
      (e) => e.blockNumber !== undefined && e.blockNumber > baseBlock,
    );
    const coveredTo = Math.max(baseBlock, cache?.lastBlock ?? -1);

    const run = async () => {
      setIsLoading(true);
      setIsUnavailable(false);
      try {
        const latest = Number(await publicClient.getBlockNumber());
        const fromBlock = coveredTo + 1;

        let tail: RawMintEntry[] = [];
        if (fromBlock <= latest) {
          const logs = await publicClient.getLogs({
            address: minter,
            event: CLAIM_MINTED,
            args: { recipient: wallet as `0x${string}` },
            fromBlock: fromBlock === 0 ? 'earliest' : BigInt(fromBlock),
            toBlock: BigInt(latest),
          });
          tail = parseClaimMintedLogs(logs)
            .filter((e) => e.recipient === wallet)
            .map(stripRecipient);
        }

        const confirmedTo = latest - CONFIRMATION_BLOCKS;
        if (confirmedTo > coveredTo) {
          const confirmed = tail.filter(
            (e) => e.blockNumber !== undefined && e.blockNumber <= confirmedTo,
          );
          writeStorage(key, {
            lastBlock: confirmedTo,
            entries: mergeMintEntries(cached, confirmed),
          });
        }

        if (!cancelled) setEntries(mergeMintEntries(blobEntries, cached, tail));
      } catch (error) {
        log.error('NFT mint price scan failed:', error);
        if (!cancelled) {
          setEntries(mergeMintEntries(blobEntries, cached));
          setIsUnavailable(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [publicClient, wallet, chainId, minter, nonce]);

  const usdc = addresses?.USDC;
  const usds = addresses?.USDS;
  const pricesByIndex = useMemo(
    () => groupPricesByIndex(entries, buildStableTokenDecimals({ USDC: usdc, USDS: usds })),
    [entries, usdc, usds],
  );

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { pricesByIndex, isLoading, isUnavailable, refresh };
}
