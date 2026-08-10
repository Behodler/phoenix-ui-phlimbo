import { useEffect, useCallback, useRef } from 'react'
import { useReadContracts, useAccount } from 'wagmi'
import { erc20Abi } from 'viem'
import { phlimboV2Abi } from '@behodler/phase2-wagmi-hooks'
import { useContractAddresses } from '../contexts/ContractAddressContext'
import { usePolling } from '../contexts/PollingContext'
import { log } from '../utils/logger'

/**
 * Polling interval in milliseconds (60 seconds)
 */
const POLLING_INTERVAL_MS = 60_000

/**
 * The seven figures the incumbent (V2) Stake tab needs.
 *
 * These used to arrive as one `DepositView.getDepositData(user)` call, but the
 * `DepositView` address key was dropped upstream and its V3 successor
 * (`DepositPageViewV3`, see `useDepositPageView`) is typed against PhlimboV3 —
 * it cannot read V2. So the same seven values are assembled here directly from
 * PhlimboV2 and phUSD, which both still exist. Field names and scaling are
 * deliberately identical to the old struct and to indices 0-6 of the V3 page,
 * so the two Stake surfaces stay comparable digit for digit.
 */
export interface PhlimboV2ReadsData {
  /** Wallet phUSD balance, 18dp. */
  userPhUSDBalance: bigint
  /** phUSD emission rate — RAW wei/sec, not PRECISION-scaled. */
  phUSDRewardsPerSecond: bigint
  /** Stable emission rate — PRECISION-scaled. */
  stableRewardsPerSecond: bigint
  /** Claimable phUSD, 18dp. */
  pendingPhUSDRewards: bigint
  /** Claimable stable (USDC), 6dp. */
  pendingStableRewards: bigint
  /** Staked phUSD, 18dp. */
  stakedBalance: bigint
  /** phUSD allowance toward the farm, 18dp. */
  userAllowance: bigint
}

export interface UsePhlimboV2ReadsReturn {
  data: PhlimboV2ReadsData | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  /** Manually trigger a refresh (e.g. after a transaction). */
  refresh: () => void
  /** Whether polling is currently active. */
  isPollingActive: boolean
}

/**
 * Polls the incumbent PhlimboV2 farm for the Stake tab.
 *
 * Same polling contract as the hook it replaces: fetches immediately when the
 * tab becomes active, polls every 60s while active, and goes fully quiet when
 * the tab is inactive or the global Live toggle is off.
 *
 * @param isTabActive - Whether the Stake tab is currently active
 */
export function usePhlimboV2Reads(isTabActive: boolean): UsePhlimboV2ReadsReturn {
  const { address: walletAddress } = useAccount()
  const { addresses } = useContractAddresses()
  const { isPollingEnabled } = usePolling()

  const lastTabActiveRef = useRef(isTabActive)

  const phlimbo = addresses?.PhlimboEA as `0x${string}` | undefined
  const phUSD = addresses?.PhUSD as `0x${string}` | undefined
  const ready = !!phlimbo && !!phUSD && !!walletAddress

  const shouldPoll = isTabActive && isPollingEnabled && ready

  const {
    data: results,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContracts({
    contracts: ready
      ? [
          { address: phUSD, abi: erc20Abi, functionName: 'balanceOf', args: [walletAddress] },
          { address: phUSD, abi: erc20Abi, functionName: 'allowance', args: [walletAddress, phlimbo] },
          { address: phlimbo, abi: phlimboV2Abi, functionName: 'userInfo', args: [walletAddress] },
          { address: phlimbo, abi: phlimboV2Abi, functionName: 'pendingPhUSD', args: [walletAddress] },
          { address: phlimbo, abi: phlimboV2Abi, functionName: 'pendingStable', args: [walletAddress] },
          { address: phlimbo, abi: phlimboV2Abi, functionName: 'phUSDPerSecond' },
          { address: phlimbo, abi: phlimboV2Abi, functionName: 'rewardPerSecond' },
        ]
      : [],
    query: {
      enabled: ready,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: POLLING_INTERVAL_MS,
    },
  })

  const value = (index: number): bigint => {
    const entry = results?.[index]
    if (!entry || entry.status !== 'success') return 0n
    return entry.result as bigint
  }

  // userInfo on V2 is a 3-tuple (amount, phUSDDebt, stableDebt); only the
  // staked amount is needed here. V3's 4-tuple is never decoded with this ABI.
  const stakedBalance = (() => {
    const entry = results?.[2]
    if (!entry || entry.status !== 'success') return 0n
    const tuple = entry.result as readonly bigint[]
    return tuple?.[0] ?? 0n
  })()

  const data: PhlimboV2ReadsData | null = results
    ? {
        userPhUSDBalance: value(0),
        userAllowance: value(1),
        stakedBalance,
        pendingPhUSDRewards: value(3),
        pendingStableRewards: value(4),
        phUSDRewardsPerSecond: value(5),
        stableRewardsPerSecond: value(6),
      }
    : null

  const refresh = useCallback(() => {
    if (isTabActive && ready) {
      log.debug('PhlimboV2: Manual refresh triggered')
      refetch()
    }
  }, [isTabActive, ready, refetch])

  // Immediate fetch when the tab becomes active.
  useEffect(() => {
    const wasTabActive = lastTabActiveRef.current
    lastTabActiveRef.current = isTabActive

    if (isTabActive && !wasTabActive && ready) {
      log.debug('PhlimboV2: Tab became active, fetching immediately')
      refetch()
    }
  }, [isTabActive, ready, refetch])

  useEffect(() => {
    if (!shouldPoll) {
      log.debug('PhlimboV2: Polling inactive', {
        isTabActive,
        isPollingEnabled,
        hasWallet: !!walletAddress,
        hasAddress: !!phlimbo,
      })
      return
    }

    log.debug('PhlimboV2: Starting 60-second polling interval')

    const intervalId = setInterval(() => {
      log.debug('PhlimboV2: Polling interval triggered')
      refetch()
    }, POLLING_INTERVAL_MS)

    return () => {
      log.debug('PhlimboV2: Stopping polling interval')
      clearInterval(intervalId)
    }
  }, [shouldPoll, refetch]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refresh,
    isPollingActive: shouldPoll,
  }
}
