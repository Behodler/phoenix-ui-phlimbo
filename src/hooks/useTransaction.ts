import { useState, useCallback, useEffect } from 'react'
import { useWaitForTransactionReceipt } from 'wagmi'
import type { Hash } from 'viem'
import { TransactionStatus, type TransactionState } from '../types/transaction'
import { parseTransactionError } from '../utils/transactionErrors'

/**
 * Configuration options for the transaction hook
 */
export interface UseTransactionConfig {
  /** Callback when transaction is successful */
  onSuccess?: (hash: Hash) => void
  /** Callback when transaction fails */
  onError?: (error: Error) => void
  /** Callback when transaction state changes */
  onStatusChange?: (status: TransactionStatus) => void
}

/**
 * Generic transaction management hook
 *
 * Provides a reusable pattern for handling Web3 transactions with comprehensive
 * state management, error handling, and user feedback.
 *
 * @param transactionFn - Function that executes the transaction (from wagmi hooks)
 * @param config - Optional configuration callbacks
 * @returns Transaction state and control functions
 *
 * @example
 * ```tsx
 * const { execute, state, reset } = useTransaction(
 *   async () => {
 *     return writeContract({
 *       address: contractAddress,
 *       abi: erc20Abi,
 *       functionName: 'approve',
 *       args: [spender, amount]
 *     })
 *   },
 *   {
 *     onSuccess: (hash) => console.log('Success!', hash),
 *     onError: (error) => console.error('Failed', error)
 *   }
 * )
 * ```
 */
export function useTransaction(
  transactionFn: () => Promise<Hash>,
  config?: UseTransactionConfig
) {
  const [state, setState] = useState<TransactionState>({
    status: 'IDLE',
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    isError: false,
  })

  // Watch for transaction receipt
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: state.hash,
    query: {
      enabled: !!state.hash,
    },
  })

  // Debug logging for wagmi hook state
  useEffect(() => {
    console.log('[useTransaction] Wagmi hook state:', {
      hash: state.hash,
      enabled: !!state.hash,
      isConfirming,
      isSuccess,
      currentStatus: state.status,
    })
  }, [state.hash, isConfirming, isSuccess, state.status])

  // Update state when confirmation status changes
  useEffect(() => {
    console.log('[useTransaction] Confirmation effect triggered:', {
      hasHash: !!state.hash,
      hash: state.hash,
      isConfirming,
      isSuccess,
      currentStatus: state.status,
    })

    if (!state.hash) {
      console.log('[useTransaction] No hash, skipping confirmation check')
      return
    }

    if (isConfirming && state.status !== 'PENDING_CONFIRMATION') {
      console.log('[useTransaction] Setting state to PENDING_CONFIRMATION')
      setState(prev => ({
        ...prev,
        status: 'PENDING_CONFIRMATION',
        isConfirming: true,
        isPending: false,
      }))
      config?.onStatusChange?.('PENDING_CONFIRMATION')
    }

    if (isSuccess && state.status !== 'SUCCESS') {
      console.log('[useTransaction] Transaction confirmed! Setting state to SUCCESS')
      setState(prev => ({
        ...prev,
        status: 'SUCCESS',
        isConfirming: false,
        isSuccess: true,
        isPending: false,
      }))
      config?.onStatusChange?.('SUCCESS')
      config?.onSuccess?.(state.hash)
    }
  }, [isConfirming, isSuccess, state.hash, state.status, config])

  /**
   * Execute the transaction
   */
  const execute = useCallback(async () => {
    try {
      console.log('[useTransaction] Execute called - waiting for signature')
      // Set to pending signature state
      setState({
        status: 'PENDING_SIGNATURE',
        isPending: true,
        isConfirming: false,
        isSuccess: false,
        isError: false,
      })
      config?.onStatusChange?.('PENDING_SIGNATURE')

      // Execute the transaction
      console.log('[useTransaction] Calling transaction function...')
      const hash = await transactionFn()
      console.log('[useTransaction] Transaction submitted! Hash:', hash)

      // Transaction submitted - now waiting for confirmation
      setState(prev => ({
        ...prev,
        hash,
        status: 'PENDING_CONFIRMATION',
        isPending: false,
        isConfirming: true,
      }))
      console.log('[useTransaction] State updated with hash, waiting for confirmation')
      config?.onStatusChange?.('PENDING_CONFIRMATION')
    } catch (error) {
      console.log('[useTransaction] Transaction error:', error)
      const parsedError = parseTransactionError(error as Error)

      // Determine if it was a cancellation or error
      const status =
        parsedError.type === 'USER_REJECTED'
          ? 'CANCELLED'
          : 'FAILED'

      setState({
        status,
        error: parsedError,
        isPending: false,
        isConfirming: false,
        isSuccess: false,
        isError: true,
      })

      config?.onStatusChange?.(status)
      config?.onError?.(error as Error)
    }
  }, [transactionFn, config])

  /**
   * Reset transaction state to idle
   */
  const reset = useCallback(() => {
    setState({
      status: 'IDLE',
      isPending: false,
      isConfirming: false,
      isSuccess: false,
      isError: false,
    })
    config?.onStatusChange?.('IDLE')
  }, [config])

  /**
   * Retry a failed transaction
   */
  const retry = useCallback(async () => {
    if (state.error?.recoverable) {
      await execute()
    }
  }, [execute, state.error])

  return {
    state,
    execute,
    reset,
    retry,
  }
}

/**
 * Hook specifically for ERC20 token approvals
 *
 * Wraps useTransaction with approval-specific logic and provides a simpler API
 *
 * @param approveFn - Function that executes the approval transaction
 * @param config - Optional configuration callbacks
 * @returns Approval transaction state and execute function
 */
export function useApprovalTransaction(
  approveFn: () => Promise<Hash>,
  config?: UseTransactionConfig
) {
  return useTransaction(approveFn, config)
}
