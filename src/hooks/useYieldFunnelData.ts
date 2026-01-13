import { useMemo } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { stableYieldAccumulatorAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { log } from '../utils/logger';

/**
 * Token info with resolved symbol and name
 */
interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Pending yield for a single strategy
 */
export interface PendingYieldItem {
  strategyAddress: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  amount: bigint;
  amountFormatted: string;
  decimals: number;
}

/**
 * Return type for useYieldFunnelData hook
 */
export interface YieldFunnelData {
  // Strategy and yield data
  strategies: string[];
  pendingYield: PendingYieldItem[];

  // Discount and pricing
  discountRate: bigint;
  discountPercent: number;
  claimAmount: bigint;
  claimAmountFormatted: string;
  totalYield: bigint;
  totalYieldFormatted: string;

  // Calculated values
  profitFormatted: string;

  // Loading and error states
  isLoading: boolean;
  isError: boolean;
  error: Error | null;

  // Refetch function
  refetch: () => void;
}

/**
 * Map of known token addresses to their info
 * Used to resolve token symbols from addresses
 */
function getTokenInfoMap(addresses: {
  Dola?: string;
  USDT?: string;
  USDS?: string;
} | null): Map<string, TokenInfo> {
  const map = new Map<string, TokenInfo>();

  if (!addresses) return map;

  if (addresses.Dola) {
    map.set(addresses.Dola.toLowerCase(), {
      symbol: 'DOLA',
      name: 'Dola USD',
      decimals: 18,
    });
  }

  if (addresses.USDT) {
    map.set(addresses.USDT.toLowerCase(), {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    });
  }

  if (addresses.USDS) {
    map.set(addresses.USDS.toLowerCase(), {
      symbol: 'USDS',
      name: 'Sky Dollar',
      decimals: 18,
    });
  }

  return map;
}

/**
 * Hook to fetch yield funnel data from StableYieldAccumulator contract
 *
 * Queries:
 * - getYieldStrategies() - list of registered strategy addresses
 * - strategyTokens(strategy) - token address for each strategy
 * - getYield(strategy) - pending yield for each strategy
 * - getDiscountRate() - discount in basis points
 * - calculateClaimAmount() - USDC amount user must pay
 * - getTotalYield() - total pending yield across all strategies
 */
export function useYieldFunnelData(): YieldFunnelData {
  const { addresses, loading: addressesLoading } = useContractAddresses();

  const accumulatorAddress = addresses?.StableYieldAccumulator as `0x${string}` | undefined;

  // Token info map for resolving symbols
  const tokenInfoMap = useMemo(() => getTokenInfoMap(addresses), [addresses]);

  // Query 1: Get list of yield strategies
  const {
    data: strategies,
    isLoading: strategiesLoading,
    isError: strategiesError,
    error: strategiesErrorObj,
    refetch: refetchStrategies,
  } = useReadContract({
    address: accumulatorAddress,
    abi: stableYieldAccumulatorAbi,
    functionName: 'getYieldStrategies',
    query: {
      enabled: !!accumulatorAddress,
    },
  });

  // Query 2: Get discount rate
  const {
    data: discountRate,
    isLoading: discountLoading,
    isError: discountError,
    refetch: refetchDiscount,
  } = useReadContract({
    address: accumulatorAddress,
    abi: stableYieldAccumulatorAbi,
    functionName: 'getDiscountRate',
    query: {
      enabled: !!accumulatorAddress,
    },
  });

  // Query 3: Get claim amount (USDC cost)
  const {
    data: claimAmount,
    isLoading: claimAmountLoading,
    isError: claimAmountError,
    refetch: refetchClaimAmount,
  } = useReadContract({
    address: accumulatorAddress,
    abi: stableYieldAccumulatorAbi,
    functionName: 'calculateClaimAmount',
    query: {
      enabled: !!accumulatorAddress,
    },
  });

  // Query 4: Get total yield
  const {
    data: totalYield,
    isLoading: totalYieldLoading,
    isError: totalYieldError,
    refetch: refetchTotalYield,
  } = useReadContract({
    address: accumulatorAddress,
    abi: stableYieldAccumulatorAbi,
    functionName: 'getTotalYield',
    query: {
      enabled: !!accumulatorAddress,
    },
  });

  // Build multicall contracts array for strategy tokens and yields
  const strategyContracts = useMemo(() => {
    if (!strategies || strategies.length === 0 || !accumulatorAddress) {
      return [];
    }

    const contracts: Array<{
      address: `0x${string}`;
      abi: typeof stableYieldAccumulatorAbi;
      functionName: 'strategyTokens' | 'getYield';
      args: readonly [`0x${string}`];
    }> = [];

    // For each strategy, we need to query both strategyTokens and getYield
    for (const strategy of strategies) {
      // Query strategyTokens(strategy) to get token address
      contracts.push({
        address: accumulatorAddress,
        abi: stableYieldAccumulatorAbi,
        functionName: 'strategyTokens',
        args: [strategy as `0x${string}`],
      });

      // Query getYield(strategy) to get pending yield
      contracts.push({
        address: accumulatorAddress,
        abi: stableYieldAccumulatorAbi,
        functionName: 'getYield',
        args: [strategy as `0x${string}`],
      });
    }

    return contracts;
  }, [strategies, accumulatorAddress]);

  // Query 5: Multicall for strategy tokens and yields
  const {
    data: strategyData,
    isLoading: strategyDataLoading,
    isError: strategyDataError,
    refetch: refetchStrategyData,
  } = useReadContracts({
    contracts: strategyContracts,
    query: {
      enabled: strategyContracts.length > 0,
    },
  });

  // Process strategy data into pending yield items
  const pendingYield = useMemo((): PendingYieldItem[] => {
    if (!strategies || strategies.length === 0 || !strategyData) {
      return [];
    }

    const items: PendingYieldItem[] = [];

    for (let i = 0; i < strategies.length; i++) {
      const strategyAddress = strategies[i];
      const tokenResult = strategyData[i * 2]; // strategyTokens result
      const yieldResult = strategyData[i * 2 + 1]; // getYield result

      if (tokenResult.status !== 'success' || yieldResult.status !== 'success') {
        log.warn('Failed to fetch data for strategy:', strategyAddress);
        continue;
      }

      const tokenAddress = tokenResult.result as string;
      const yieldAmount = yieldResult.result as bigint;

      // Skip if no pending yield
      if (yieldAmount === 0n) {
        continue;
      }

      // Resolve token info
      const tokenInfo = tokenInfoMap.get(tokenAddress.toLowerCase());
      const symbol = tokenInfo?.symbol ?? 'UNKNOWN';
      const name = tokenInfo?.name ?? 'Unknown Token';
      const decimals = tokenInfo?.decimals ?? 18;

      items.push({
        strategyAddress,
        tokenAddress,
        symbol,
        name,
        amount: yieldAmount,
        amountFormatted: formatUnits(yieldAmount, decimals),
        decimals,
      });
    }

    return items;
  }, [strategies, strategyData, tokenInfoMap]);

  // Calculate derived values
  const discountPercent = discountRate ? Number(discountRate) / 100 : 0;

  // Format amounts (USDC has 6 decimals)
  const claimAmountFormatted = claimAmount
    ? parseFloat(formatUnits(claimAmount, 6)).toFixed(2)
    : '0.00';

  // Total yield is in a normalized form (likely 18 decimals, representing USD value)
  const totalYieldFormatted = totalYield
    ? parseFloat(formatUnits(totalYield, 18)).toFixed(2)
    : '0.00';

  // Profit is totalYield - claimAmount (both normalized to USD)
  const profitFormatted = useMemo(() => {
    if (!totalYield || !claimAmount) return '0.00';

    // Convert both to the same scale for calculation
    // totalYield is in 18 decimals, claimAmount is in 6 decimals
    const totalYieldUsd = parseFloat(formatUnits(totalYield, 18));
    const claimAmountUsd = parseFloat(formatUnits(claimAmount, 6));
    const profit = totalYieldUsd - claimAmountUsd;
    return profit.toFixed(2);
  }, [totalYield, claimAmount]);

  // Combined loading state
  const isLoading =
    addressesLoading ||
    strategiesLoading ||
    discountLoading ||
    claimAmountLoading ||
    totalYieldLoading ||
    strategyDataLoading;

  // Combined error state
  const isError =
    strategiesError ||
    discountError ||
    claimAmountError ||
    totalYieldError ||
    strategyDataError;

  // Refetch all data
  const refetch = () => {
    refetchStrategies();
    refetchDiscount();
    refetchClaimAmount();
    refetchTotalYield();
    refetchStrategyData();
  };

  // Debug logging
  log.debug('useYieldFunnelData:', {
    strategies: strategies?.length ?? 0,
    pendingYield: pendingYield.length,
    discountPercent,
    claimAmountFormatted,
    totalYieldFormatted,
    isLoading,
    isError,
  });

  return {
    strategies: (strategies as string[]) ?? [],
    pendingYield,
    discountRate: discountRate ?? 0n,
    discountPercent,
    claimAmount: claimAmount ?? 0n,
    claimAmountFormatted,
    totalYield: totalYield ?? 0n,
    totalYieldFormatted,
    profitFormatted,
    isLoading,
    isError,
    error: strategiesErrorObj ?? null,
    refetch,
  };
}
