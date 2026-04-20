import { useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { nftMinterAbi, nftMigratorAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function isZero(addr?: string | null): boolean {
  return !addr || addr.toLowerCase() === ZERO_ADDRESS;
}

export interface UseV1NFTStatusResult {
  /** True when the connected wallet holds at least one V1 NFT (sum of balances > 0). */
  hasV1: boolean;
  /** Raw per-index balances returned by V1 balanceOfBatch; empty array until loaded. */
  v1Balances: readonly bigint[];
  /** True when NFTMigrator.initialized() === true. */
  migratorReady: boolean;
  /** True while any gated underlying read is in flight. */
  loading: boolean;
  /** Re-runs the balance and migrator-initialized reads. */
  refetch: () => void;
}

/**
 * Detects whether the given wallet holds V1 NFTs and whether the NFTMigrator
 * is ready to service an upgrade.
 *
 * Reads (all gated via wagmi's `query.enabled`):
 *  1. `V1.nftMinter.nextIndex()` — number of V1 NFT types.
 *  2. `V1.nftMinter.balanceOfBatch([user,...], [0..n-1])` — per-index balances.
 *  3. `NFTMigrator.initialized()` — deployment readiness flag.
 *
 * Zero-address guards:
 *  - Suppresses all reads when `addresses.nftsV1.NFTMinter` is the zero address.
 *  - Suppresses the migrator read when `addresses.NFTMigrator` is the zero address.
 */
export function useV1NFTStatus(
  walletAddress?: `0x${string}`,
): UseV1NFTStatusResult {
  const { addresses } = useContractAddresses();

  const v1NFTMinterAddress = addresses?.nftsV1.NFTMinter as
    | `0x${string}`
    | undefined;
  const migratorAddress = addresses?.NFTMigrator as `0x${string}` | undefined;

  const v1Ready =
    !!walletAddress && !!v1NFTMinterAddress && !isZero(v1NFTMinterAddress);
  const migratorReadEnabled =
    !!migratorAddress && !isZero(migratorAddress);

  // 1) V1 nextIndex — tells us how many V1 NFT types exist.
  const {
    data: nextIndex,
    isLoading: isNextIndexLoading,
    refetch: refetchNextIndex,
  } = useReadContract({
    address: v1NFTMinterAddress,
    abi: nftMinterAbi,
    functionName: 'nextIndex',
    query: {
      enabled: v1Ready,
      refetchOnWindowFocus: false,
    },
  });

  // Build the batched accounts/ids arrays. Only kick off the batch once we
  // know nextIndex.
  const n = nextIndex !== undefined ? Number(nextIndex) : 0;
  const ids: bigint[] =
    n > 0 ? Array.from({ length: n }, (_, i) => BigInt(i)) : [];
  const accounts: `0x${string}`[] =
    v1Ready && n > 0 ? (Array(n).fill(walletAddress) as `0x${string}`[]) : [];

  // 2) V1 balanceOfBatch — batch-read holder balances for all V1 indices.
  const {
    data: balances,
    isLoading: isBalancesLoading,
    refetch: refetchBalances,
  } = useReadContract({
    address: v1NFTMinterAddress,
    abi: nftMinterAbi,
    functionName: 'balanceOfBatch',
    args: accounts.length > 0 ? [accounts, ids] : undefined,
    query: {
      enabled: v1Ready && accounts.length > 0,
      refetchOnWindowFocus: false,
    },
  });

  // 3) Migrator initialized flag.
  const {
    data: migratorInitialized,
    isLoading: isMigratorInitializedLoading,
    refetch: refetchMigratorInitialized,
  } = useReadContract({
    address: migratorAddress,
    abi: nftMigratorAbi,
    functionName: 'initialized',
    query: {
      enabled: migratorReadEnabled,
      refetchOnWindowFocus: false,
    },
  });

  const v1Balances: readonly bigint[] = (balances as readonly bigint[] | undefined) ?? [];
  const hasV1 = v1Balances.some((b) => b > 0n);
  const migratorReady = migratorInitialized === true;

  // `loading` is true when a gated read is still in flight. Once gates are
  // closed (e.g. zero-address, no wallet) the hook should not report loading.
  const loading =
    (v1Ready && isNextIndexLoading) ||
    (v1Ready && n > 0 && isBalancesLoading) ||
    (migratorReadEnabled && isMigratorInitializedLoading);

  const refetch = useCallback(() => {
    if (v1Ready) {
      void refetchNextIndex();
      if (n > 0) void refetchBalances();
    }
    if (migratorReadEnabled) void refetchMigratorInitialized();
  }, [
    v1Ready,
    migratorReadEnabled,
    n,
    refetchNextIndex,
    refetchBalances,
    refetchMigratorInitialized,
  ]);

  return {
    hasV1,
    v1Balances,
    migratorReady,
    loading,
    refetch,
  };
}

export default useV1NFTStatus;
