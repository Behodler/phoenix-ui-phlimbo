import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { nftMinterV2Abi } from '@behodler/phase2-wagmi-hooks';
import { useMinterPageView } from './useMinterPageView';
import { nftStaticConfig } from '../data/nftMockData';

export interface ClaimNftHoldings {
  /**
   * Wallet claim-NFT holdings, keyed by `nftStaticConfig` id → units. That id is
   * a display key only; the on-chain ERC1155 tokenId is the dispatcher index.
   */
  nftHoldings: Record<number, number>;
  /** On-chain ERC1155 tokenId (dispatcher index) for a `nftStaticConfig` id. */
  tokenIdFor: (configId: number) => bigint | undefined;
  /** True until MintPageView has supplied the dispatcher indices. */
  mappingLoading: boolean;
  refetch: () => void;
}

/**
 * The connected wallet's claim-NFT balances on `nftMinter` (an NFTMinterV2).
 *
 * NFTMinterV2 mints tokenId == dispatcher index, assigned in registration order
 * (EYE 1, SCX 2, Flax 3, ...), which is NOT the `nftStaticConfig` id order. So
 * each NFT's index is read from MintPageView, as the mint flow does.
 */
export function useClaimNftHoldings(
  wallet: `0x${string}` | undefined,
  nftMinter: `0x${string}` | undefined,
  refetchInterval: number | false,
): ClaimNftHoldings {
  const { data: mintView, isLoading: mintViewLoading } = useMinterPageView();
  const tokenIds = useMemo(() => {
    const out: { configId: number; tokenId: bigint }[] = [];
    if (!mintView) return out;
    for (const n of nftStaticConfig) {
      const index = mintView[n.tokenPrefix]?.dispatcherIndex;
      if (index) out.push({ configId: n.id, tokenId: BigInt(index) });
    }
    return out;
  }, [mintView]);

  const { data: balancesRaw, refetch } = useReadContract({
    address: nftMinter,
    abi: nftMinterV2Abi,
    functionName: 'balanceOfBatch',
    args: wallet ? [tokenIds.map(() => wallet), tokenIds.map((t) => t.tokenId)] : undefined,
    query: { enabled: !!nftMinter && !!wallet && tokenIds.length > 0, refetchInterval },
  });
  const nftHoldings = useMemo(() => {
    const out: Record<number, number> = {};
    const balances = balancesRaw as readonly bigint[] | undefined;
    tokenIds.forEach(({ configId }, i) => {
      out[configId] = balances ? Number(balances[i] ?? 0n) : 0;
    });
    return out;
  }, [balancesRaw, tokenIds]);

  const tokenIdFor = (configId: number) => tokenIds.find((t) => t.configId === configId)?.tokenId;

  return {
    nftHoldings,
    tokenIdFor,
    mappingLoading: mintViewLoading || !mintView,
    refetch: () => void refetch(),
  };
}
