import { useReadContract } from 'wagmi';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { mintPageViewAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { nftStaticConfig } from '../data/nftMockData';

/**
 * Per-token data parsed from MinterPageView.getData()
 */
export interface TokenMintData {
  /** Raw allowance as bigint (for comparison with price) */
  allowanceRaw: bigint;
  /** Raw price as bigint (for comparison with allowance) */
  priceRaw: bigint;
  /** Raw user token balance as bigint (for balance guard comparisons) */
  balanceRaw: bigint;
  /** Formatted allowance (18 decimals) */
  allowance: string;
  /** Formatted price in input token amount (18 decimals) */
  price: string;
  /** Growth rate in basis points (raw number, e.g. 250 = 2.5%) */
  growthBasisPoints: number;
  /** Formatted user token balance (18 decimals) */
  balance: string;
  /** NFT balance (quantity owned, integer) */
  nftBalance: number;
  /** Dispatcher index used by NFTMinter.mint() to identify this token's dispatcher */
  dispatcherIndex: number;
}

/**
 * All parsed data from MinterPageView
 */
export interface MinterPageViewData {
  EYE: TokenMintData;
  SCX: TokenMintData;
  Flax: TokenMintData;
  USDS: TokenMintData;
  WBTC: TokenMintData;
  eyeTotalBurnt: string;
  scxTotalBurnt: string;
  flaxTotalBurnt: string;
}

export interface UseMinterPageViewReturn {
  data: MinterPageViewData | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Field index mapping from MinterPageView.getData()
 * Each token has 6 consecutive fields: allowance, price, growthBasisPoints, balance, nftBalance, dispatcherIndex
 */
const TOKEN_OFFSETS = {
  EYE: 0,
  SCX: 6,
  Flax: 12,
  USDS: 18,
  WBTC: 24,
} as const;

const BURN_INDICES = {
  eyeTotalBurnt: 30,
  scxTotalBurnt: 31,
  flaxTotalBurnt: 32,
} as const;

/** Decimals per token prefix, derived from static config */
const TOKEN_DECIMALS: Record<string, number> = Object.fromEntries(
  nftStaticConfig.map((c) => [c.tokenPrefix, c.decimals]),
);

function parseTokenData(data: readonly bigint[], offset: number, decimals: number): TokenMintData {
  const allowanceRaw = data[offset];
  const priceRaw = data[offset + 1];
  const growthBasisPointsRaw = data[offset + 2];
  const balanceRaw = data[offset + 3];
  const nftBalanceRaw = data[offset + 4];
  const dispatcherIndexRaw = data[offset + 5];

  return {
    allowanceRaw,
    priceRaw,
    balanceRaw,
    allowance: formatUnits(allowanceRaw, decimals),
    price: formatUnits(priceRaw, decimals),
    growthBasisPoints: Number(growthBasisPointsRaw),
    balance: formatUnits(balanceRaw, decimals),
    nftBalance: Number(nftBalanceRaw),
    dispatcherIndex: Number(dispatcherIndexRaw),
  };
}

/**
 * Hook to fetch and parse MinterPageView contract data.
 * Calls getData(userAddress) and parses the uint256[] into structured token data.
 */
export function useMinterPageView(): UseMinterPageViewReturn {
  const { address: userAddress } = useAccount();
  const { addresses } = useContractAddresses();

  const mintPageViewAddress = addresses?.MintPageView as `0x${string}` | undefined;

  const {
    data: rawData,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContract({
    address: mintPageViewAddress,
    abi: mintPageViewAbi,
    functionName: 'getData',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress && !!mintPageViewAddress && mintPageViewAddress !== '0x0000000000000000000000000000000000000000',
      refetchOnWindowFocus: false,
      staleTime: 15_000, // 15 seconds
    },
  });

  let parsedData: MinterPageViewData | null = null;

  if (rawData && Array.isArray(rawData) && rawData.length >= 33) {
    parsedData = {
      EYE: parseTokenData(rawData, TOKEN_OFFSETS.EYE, TOKEN_DECIMALS.EYE),
      SCX: parseTokenData(rawData, TOKEN_OFFSETS.SCX, TOKEN_DECIMALS.SCX),
      Flax: parseTokenData(rawData, TOKEN_OFFSETS.Flax, TOKEN_DECIMALS.Flax),
      USDS: parseTokenData(rawData, TOKEN_OFFSETS.USDS, TOKEN_DECIMALS.USDS),
      WBTC: parseTokenData(rawData, TOKEN_OFFSETS.WBTC, TOKEN_DECIMALS.WBTC),
      eyeTotalBurnt: formatUnits(rawData[BURN_INDICES.eyeTotalBurnt], 18),
      scxTotalBurnt: formatUnits(rawData[BURN_INDICES.scxTotalBurnt], 18),
      flaxTotalBurnt: formatUnits(rawData[BURN_INDICES.flaxTotalBurnt], 18),
    };
  }

  return {
    data: parsedData,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
