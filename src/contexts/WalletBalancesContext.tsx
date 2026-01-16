import { createContext, useContext, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { useContractAddresses } from './ContractAddressContext'
import { useTokenBalance } from '../hooks/useContractInteractions'
import { log } from '../utils/logger'

/**
 * Wallet Balances Context State
 *
 * Provides DOLA, phUSD, and USDC balance data with a centralized refresh function
 * that can be called after transactions to update the navbar display.
 */
interface WalletBalancesContextState {
  /** Raw DOLA balance in wei (18 decimals) */
  dolaBalanceRaw: bigint | undefined
  /** Raw phUSD balance in wei (18 decimals) */
  phUsdBalanceRaw: bigint | undefined
  /** Raw USDC balance in wei (6 decimals) */
  usdcBalanceRaw: bigint | undefined
  /** Loading state for DOLA balance */
  dolaLoading: boolean
  /** Loading state for phUSD balance */
  phUsdLoading: boolean
  /** Loading state for USDC balance */
  usdcLoading: boolean
  /** Error state for DOLA balance */
  dolaError: boolean
  /** Error state for phUSD balance */
  phUsdError: boolean
  /** Error state for USDC balance */
  usdcError: boolean
  /** Refresh all wallet balances - call after successful transactions */
  refreshWalletBalances: () => void
}

/**
 * Wallet Balances Context
 */
const WalletBalancesContext = createContext<WalletBalancesContextState | undefined>(undefined)

/**
 * Wallet Balances Provider Props
 */
interface WalletBalancesProviderProps {
  children: ReactNode
}

/**
 * Wallet Balances Provider Component
 *
 * Provides centralized access to wallet token balances (DOLA, phUSD, USDC)
 * and exposes a refreshWalletBalances() function that can be called from
 * anywhere in the app to update balances after transactions.
 *
 * @example
 * ```tsx
 * <WalletBalancesProvider>
 *   <App />
 * </WalletBalancesProvider>
 * ```
 */
export function WalletBalancesProvider({ children }: WalletBalancesProviderProps) {
  const { address: walletAddress } = useAccount()
  const { addresses } = useContractAddresses()

  // Fetch DOLA balance
  const {
    balance: dolaBalanceRaw,
    isLoading: dolaLoading,
    isError: dolaError,
    refetch: refetchDola
  } = useTokenBalance(
    walletAddress,
    addresses?.Dola as `0x${string}` | undefined
  )

  // Fetch phUSD balance
  const {
    balance: phUsdBalanceRaw,
    isLoading: phUsdLoading,
    isError: phUsdError,
    refetch: refetchPhUsd
  } = useTokenBalance(
    walletAddress,
    addresses?.PhUSD as `0x${string}` | undefined
  )

  // Fetch USDC balance
  const {
    balance: usdcBalanceRaw,
    isLoading: usdcLoading,
    isError: usdcError,
    refetch: refetchUsdc
  } = useTokenBalance(
    walletAddress,
    addresses?.USDC as `0x${string}` | undefined
  )

  /**
   * Refresh all wallet balances
   * Call this after successful transactions to update the navbar display
   */
  const refreshWalletBalances = useCallback(() => {
    log.debug('WalletBalancesContext: Refreshing all wallet balances')

    // Refetch all three balances
    refetchDola()
    refetchPhUsd()
    refetchUsdc()
  }, [refetchDola, refetchPhUsd, refetchUsdc])

  return (
    <WalletBalancesContext.Provider
      value={{
        dolaBalanceRaw,
        phUsdBalanceRaw,
        usdcBalanceRaw,
        dolaLoading,
        phUsdLoading,
        usdcLoading,
        dolaError,
        phUsdError,
        usdcError,
        refreshWalletBalances
      }}
    >
      {children}
    </WalletBalancesContext.Provider>
  )
}

/**
 * Custom hook to access wallet balances and refresh function
 *
 * @returns Wallet balances context state with balance data and refresh function
 * @throws Error if used outside of WalletBalancesProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { dolaBalanceRaw, refreshWalletBalances } = useWalletBalances()
 *
 *   const handleTransactionSuccess = () => {
 *     // Refresh navbar balances after transaction
 *     refreshWalletBalances()
 *   }
 *
 *   return <div>DOLA: {dolaBalanceRaw?.toString()}</div>
 * }
 * ```
 */
export function useWalletBalances(): WalletBalancesContextState {
  const context = useContext(WalletBalancesContext)

  if (context === undefined) {
    throw new Error('useWalletBalances must be used within a WalletBalancesProvider')
  }

  return context
}
