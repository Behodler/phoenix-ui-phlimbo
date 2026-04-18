import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { phlimboEaAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';

/**
 * Solvency status thresholds (in days)
 */
const RUNWAY_WARNING_DAYS = 14; // Yellow when runway < 14 days
const RUNWAY_CRITICAL_DAYS = 3; // Red when runway < 3 days

/**
 * Runway health status for semantic coloring
 */
export type RunwayHealth = 'healthy' | 'warning' | 'critical';

/**
 * Return type for useSolvencyInfo hook
 */
export interface SolvencyInfo {
  // Raw values (in raw token units)
  actualBalance: bigint;
  owedToStakers: bigint;
  runway: bigint;

  // Formatted display values (in human-readable USDC)
  actualBalanceFormatted: string;
  owedToStakersFormatted: string;
  runwayFormatted: string;

  // Runway time estimate
  runwayDays: number;
  runwayTimeFormatted: string;

  // Health status for UI coloring
  runwayHealth: RunwayHealth;

  // Loading and error states
  isLoading: boolean;
  isError: boolean;
  error: Error | null;

  // Refetch function
  refetch: () => void;
}

/**
 * PRECISION constant used in the contract for rewardPerSecond scaling
 * rewardPerSecond is stored as (actualRate * 1e18)
 */
const PRECISION = BigInt(1e18);

/**
 * USDC decimals
 */
const USDC_DECIMALS = 6;

/**
 * Hook to fetch solvency information for the PhlimboEA contract
 *
 * Calculates:
 * - actualBalance: USDC tokens held by PhlimboEA
 * - owedToStakers: Rewards already accrued but not yet claimed
 * - runway: Tokens available for future distribution (buffer before insolvency)
 *
 * The calculation follows the logic:
 * - projectedRewardBalance = rewardBalance - (rewardPerSecond * timeElapsed / PRECISION)
 * - owedToStakers = actualBalance - projectedRewardBalance
 * - runway = projectedRewardBalance
 */
export function useSolvencyInfo(): SolvencyInfo {
  const { addresses, loading: addressesLoading } = useContractAddresses();

  const phlimboAddress = addresses?.PhlimboEA as `0x${string}` | undefined;
  const usdcAddress = addresses?.USDC as `0x${string}` | undefined;

  // Fetch rewardBalance from PhlimboEA (undistributed rewards)
  const {
    data: rewardBalance,
    isLoading: rewardBalanceLoading,
    isError: rewardBalanceError,
    error: rewardBalanceErrorObj,
    refetch: refetchRewardBalance,
  } = useReadContract({
    address: phlimboAddress,
    abi: phlimboEaAbi,
    functionName: 'rewardBalance',
    query: {
      enabled: !!phlimboAddress,
    },
  });

  // Fetch rewardPerSecond from PhlimboEA (scaled by 1e18 precision)
  const {
    data: rewardPerSecond,
    isLoading: rewardPerSecondLoading,
    isError: rewardPerSecondError,
    refetch: refetchRewardPerSecond,
  } = useReadContract({
    address: phlimboAddress,
    abi: phlimboEaAbi,
    functionName: 'rewardPerSecond',
    query: {
      enabled: !!phlimboAddress,
    },
  });

  // Fetch pool info for lastRewardTime and totalStaked
  const {
    data: poolInfo,
    isLoading: poolInfoLoading,
    isError: poolInfoError,
    refetch: refetchPoolInfo,
  } = useReadContract({
    address: phlimboAddress,
    abi: phlimboEaAbi,
    functionName: 'getPoolInfo',
    query: {
      enabled: !!phlimboAddress,
    },
  });

  // Fetch actual USDC balance held by PhlimboEA
  const {
    data: actualBalance,
    isLoading: actualBalanceLoading,
    isError: actualBalanceError,
    refetch: refetchActualBalance,
  } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: phlimboAddress ? [phlimboAddress] : undefined,
    query: {
      enabled: !!usdcAddress && !!phlimboAddress,
    },
  });

  // Extract values from poolInfo tuple
  // poolInfo returns: (totalStaked, accPhUSDPerShare, accStablePerShare, phUSDPerSecond, lastRewardTime)
  const totalStaked = poolInfo ? poolInfo[0] : 0n;
  const lastRewardTime = poolInfo ? poolInfo[4] : 0n;

  // Calculate solvency values
  const { owedToStakers, runway, runwayDays } = useMemo(() => {
    if (
      actualBalance === undefined ||
      rewardBalance === undefined ||
      rewardPerSecond === undefined ||
      lastRewardTime === undefined ||
      totalStaked === undefined
    ) {
      return {
        owedToStakers: 0n,
        runway: 0n,
        runwayDays: 0,
      };
    }

    const now = BigInt(Math.floor(Date.now() / 1000));

    // Project rewardBalance as if _updatePool() ran now
    let projectedRewardBalance = rewardBalance;

    if (now > lastRewardTime && totalStaked > 0n) {
      const timeElapsed = now - lastRewardTime;
      const potentialDistribute = (rewardPerSecond * timeElapsed) / PRECISION;
      const toDistribute = potentialDistribute > rewardBalance ? rewardBalance : potentialDistribute;
      projectedRewardBalance = rewardBalance - toDistribute;
    }

    // Calculate owedToStakers and runway
    const calculatedOwedToStakers = actualBalance > projectedRewardBalance
      ? actualBalance - projectedRewardBalance
      : 0n;
    const calculatedRunway = projectedRewardBalance;

    // Calculate runway in days
    // rewardPerSecond is scaled by 1e18, so daily distribution = (rewardPerSecond * 86400) / 1e18
    let calculatedRunwayDays = 0;
    if (rewardPerSecond > 0n) {
      // runway / (rewardPerSecond / PRECISION) = runway * PRECISION / rewardPerSecond
      // This gives us runway in seconds, then divide by 86400 for days
      const runwaySeconds = (calculatedRunway * PRECISION) / rewardPerSecond;
      calculatedRunwayDays = Number(runwaySeconds) / 86400;
    } else {
      // If no rewards are being distributed, runway is infinite
      calculatedRunwayDays = calculatedRunway > 0n ? Infinity : 0;
    }

    return {
      owedToStakers: calculatedOwedToStakers,
      runway: calculatedRunway,
      runwayDays: calculatedRunwayDays,
    };
  }, [actualBalance, rewardBalance, rewardPerSecond, lastRewardTime, totalStaked]);

  // Format values for display
  const actualBalanceFormatted = actualBalance !== undefined
    ? (Number(actualBalance) / Math.pow(10, USDC_DECIMALS)).toFixed(2)
    : '0.00';

  const owedToStakersFormatted = (Number(owedToStakers) / Math.pow(10, USDC_DECIMALS)).toFixed(2);
  const runwayFormatted = (Number(runway) / Math.pow(10, USDC_DECIMALS)).toFixed(2);

  // Format runway time
  const runwayTimeFormatted = useMemo(() => {
    if (!Number.isFinite(runwayDays)) {
      return 'Infinite (no distribution)';
    }
    if (runwayDays === 0) {
      return '0 days';
    }
    if (runwayDays < 1) {
      const hours = runwayDays * 24;
      if (hours < 1) {
        const minutes = Math.round(hours * 60);
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
      return `${hours.toFixed(1)} hours`;
    }
    if (runwayDays < 7) {
      return `${runwayDays.toFixed(1)} days`;
    }
    return `${Math.round(runwayDays)} days`;
  }, [runwayDays]);

  // Determine runway health status
  const runwayHealth: RunwayHealth = useMemo(() => {
    if (!Number.isFinite(runwayDays) || runwayDays >= RUNWAY_WARNING_DAYS) {
      return 'healthy';
    }
    if (runwayDays >= RUNWAY_CRITICAL_DAYS) {
      return 'warning';
    }
    return 'critical';
  }, [runwayDays]);

  // Combined loading state
  const isLoading =
    addressesLoading ||
    rewardBalanceLoading ||
    rewardPerSecondLoading ||
    poolInfoLoading ||
    actualBalanceLoading;

  // Combined error state
  const isError =
    rewardBalanceError ||
    rewardPerSecondError ||
    poolInfoError ||
    actualBalanceError;

  // Refetch all data
  const refetch = () => {
    refetchRewardBalance();
    refetchRewardPerSecond();
    refetchPoolInfo();
    refetchActualBalance();
  };

  return {
    actualBalance: actualBalance ?? 0n,
    owedToStakers,
    runway,
    actualBalanceFormatted,
    owedToStakersFormatted,
    runwayFormatted,
    runwayDays,
    runwayTimeFormatted,
    runwayHealth,
    isLoading,
    isError,
    error: rewardBalanceErrorObj ?? null,
    refetch,
  };
}
