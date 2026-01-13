import { useState, useCallback, useEffect } from 'react'
import { useWaitForTransactionReceipt } from 'wagmi'
import type { Hash } from 'viem'
import { TransactionStatus, type TransactionState } from '../types/transaction'
import { parseTransactionError } from '../utils/transactionErrors'
import { log } from '../utils/logger'

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
 *     onSuccess: (hash) => ,
 *     onError: (error) => log.error('Failed', error)
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
  const receiptResult = useWaitForTransactionReceipt({
    hash: state.hash,
    query: {
      enabled: !!state.hash,
      // Retry configuration to handle transient RPC errors
      retry: 3,
      retryDelay: 1000,
    },
  })

  const { isLoading: isConfirming, isSuccess, isError: isReceiptError, error: receiptError, data: receipt } = receiptResult

  // Debug logging for receipt watching
  useEffect(() => {
    if (state.hash) {
      log.debug('[useTransaction] Receipt watcher state:', {
        hash: state.hash,
        isConfirming,
        isSuccess,
        isReceiptError,
        receiptStatus: receipt?.status,
        currentStatus: state.status
      })
    }
  }, [state.hash, isConfirming, isSuccess, isReceiptError, receipt, state.status])

  // Update state when confirmation status changes (including errors)
  useEffect(() => {
    if (!state.hash) {
      return
    }

    // Handle receipt watching errors - this prevents the transaction from hanging forever
    if (isReceiptError && state.status !== 'FAILED') {
      log.error('[useTransaction] Receipt watching error:', receiptError)
      const parsedError = parseTransactionError(receiptError as Error)
      setState(prev => ({
        ...prev,
        status: 'FAILED',
        error: parsedError,
        isConfirming: false,
        isSuccess: false,
        isError: true,
        isPending: false,
      }))
      config?.onStatusChange?.('FAILED')
      config?.onError?.(receiptError as Error)
      return
    }

    if (isConfirming && state.status !== 'PENDING_CONFIRMATION') {
      setState(prev => ({
        ...prev,
        status: 'PENDING_CONFIRMATION',
        isConfirming: true,
        isPending: false,
      }))
      config?.onStatusChange?.('PENDING_CONFIRMATION')
    }

    if (isSuccess && state.status !== 'SUCCESS') {
      log.debug('[useTransaction] Transaction confirmed! Transitioning to SUCCESS')
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
  }, [isConfirming, isSuccess, isReceiptError, receiptError, state.hash, state.status, config])

  /**
   * Execute the transaction
   */
  const execute = useCallback(async () => {
    // Prevent re-execution while transaction is in progress
    if (state.status === 'PENDING_SIGNATURE' || state.status === 'PENDING_CONFIRMATION') {
      log.warn('[useTransaction] Ignoring execute() call - transaction already in progress:', state.status)
      return
    }

    try {
      log.debug('[useTransaction] Starting transaction execution')
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
      log.debug('[useTransaction] Calling transaction function...')
      const hash = await transactionFn()
      log.debug('[useTransaction] Transaction submitted, hash:', hash)

      // Transaction submitted - now waiting for confirmation
      setState(prev => ({
        ...prev,
        hash,
        status: 'PENDING_CONFIRMATION',
        isPending: false,
        isConfirming: true,
      }))
      log.debug('[useTransaction] State updated to PENDING_CONFIRMATION')
      config?.onStatusChange?.('PENDING_CONFIRMATION')
    } catch (error) {
      log.error('[useTransaction] Transaction execution failed:', error)
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
  }, [transactionFn, config, state.status])

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
