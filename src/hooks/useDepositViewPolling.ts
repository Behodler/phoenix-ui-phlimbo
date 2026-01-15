import { useEffect, useCallback, useRef } from 'react'
import { useReadContract, useAccount } from 'wagmi'
import { depositViewAbi } from '@behodler/phase2-wagmi-hooks'
import { useContractAddresses } from '../contexts/ContractAddressContext'
import { usePolling } from '../contexts/PollingContext'
import { log } from '../utils/logger'

/**
 * Polling interval in milliseconds (60 seconds)
 */
const POLLING_INTERVAL_MS = 60_000

/**
 * DepositView data structure returned from the contract
 */
export interface DepositViewData {
  userPhUSDBalance: bigint
  phUSDRewardsPerSecond: bigint
  stableRewardsPerSecond: bigint
  pendingPhUSDRewards: bigint
  pendingStableRewards: bigint
  stakedBalance: bigint
  userAllowance: bigint
}

/**
 * Return type for useDepositViewPolling hook
 */
export interface UseDepositViewPollingReturn {
  /** The deposit view data from the contract */
  data: DepositViewData | null
  /** Whether the data is currently loading */
  isLoading: boolean
  /** Whether there was an error fetching data */
  isError: boolean
  /** Error object if any */
  error: Error | null
  /** Manually trigger a refresh of the data */
  refresh: () => void
  /** Whether polling is currently active */
  isPollingActive: boolean
}

/**
 * Custom hook for polling DepositView contract data
 *
 * Features:
 * - Polls every 60 seconds when isTabActive is true
 * - Immediately fetches data when tab becomes active
 * - Stops all polling when tab is inactive (no ghost RPC calls)
 * - Respects global polling toggle (disables all polling when toggle is off)
 * - Provides manual refresh capability for transaction-triggered updates
 *
 * @param isTabActive - Whether the Deposit tab is currently active
 * @returns DepositView data, loading state, error state, and refresh function
 *
 * @example
 * ```tsx
 * function DepositTab() {
 *   const { data, isLoading, refresh } = useDepositViewPolling(true)
 *
 *   // Trigger refresh after transaction
 *   const handleTransactionSuccess = () => {
 *     refresh()
 *   }
 *
 *   return (
 *     <div>
 *       {isLoading ? 'Loading...' : `Balance: ${data?.userPhUSDBalance}`}
 *     </div>
 *   )
 * }
 * ```
 */
export function useDepositViewPolling(isTabActive: boolean): UseDepositViewPollingReturn {
  const { address: walletAddress } = useAccount()
  const { addresses } = useContractAddresses()
  const { isPollingEnabled } = usePolling()

  // Track if this is the first fetch after tab becomes active
  const lastTabActiveRef = useRef(isTabActive)

  // Determine if we should be polling
  const shouldPoll = isTabActive && isPollingEnabled && !!walletAddress && !!addresses?.DepositView

  // Read contract with wagmi's useReadContract
  const {
    data: rawData,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContract({
    address: addresses?.DepositView as `0x${string}` | undefined,
    abi: depositViewAbi,
    functionName: 'getDepositData',
    args: walletAddress ? [walletAddress] : undefined,
    query: {
      // Only enable the query when we have necessary data
      enabled: !!addresses?.DepositView && !!walletAddress,
      // Disable automatic refetching - we'll handle it manually
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      // Keep stale data while refetching
      staleTime: POLLING_INTERVAL_MS,
    },
  })

  // Parse the raw contract data into our typed structure
  const data: DepositViewData | null = rawData
    ? {
        userPhUSDBalance: (rawData as any).userPhUSDBalance ?? 0n,
        phUSDRewardsPerSecond: (rawData as any).phUSDRewardsPerSecond ?? 0n,
        stableRewardsPerSecond: (rawData as any).stableRewardsPerSecond ?? 0n,
        pendingPhUSDRewards: (rawData as any).pendingPhUSDRewards ?? 0n,
        pendingStableRewards: (rawData as any).pendingStableRewards ?? 0n,
        stakedBalance: (rawData as any).stakedBalance ?? 0n,
        userAllowance: (rawData as any).userAllowance ?? 0n,
      }
    : null

  // Refresh function for external use (e.g., after transactions)
  const refresh = useCallback(() => {
    if (isTabActive && walletAddress && addresses?.DepositView) {
      log.debug('DepositView: Manual refresh triggered')
      refetch()
    }
  }, [isTabActive, walletAddress, addresses?.DepositView, refetch])

  // Immediate fetch when tab becomes active
  useEffect(() => {
    const wasTabActive = lastTabActiveRef.current
    lastTabActiveRef.current = isTabActive

    // Tab just became active - fetch immediately
    if (isTabActive && !wasTabActive && walletAddress && addresses?.DepositView) {
      log.debug('DepositView: Tab became active, fetching immediately')
      refetch()
    }
  }, [isTabActive, walletAddress, addresses?.DepositView, refetch])

  // Polling interval - only active when shouldPoll is true
  useEffect(() => {
    if (!shouldPoll) {
      log.debug('DepositView: Polling inactive', {
        isTabActive,
        isPollingEnabled,
        hasWallet: !!walletAddress,
        hasAddress: !!addresses?.DepositView,
      })
      return
    }

    log.debug('DepositView: Starting 60-second polling interval')

    const intervalId = setInterval(() => {
      log.debug('DepositView: Polling interval triggered')
      refetch()
    }, POLLING_INTERVAL_MS)

    // Cleanup interval on unmount or when shouldPoll becomes false
    return () => {
      log.debug('DepositView: Stopping polling interval')
      clearInterval(intervalId)
    }
  }, [shouldPoll, refetch])

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refresh,
    isPollingActive: shouldPoll,
  }
}
