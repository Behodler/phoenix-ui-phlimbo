import type { Hash } from 'viem'

/**
 * Transaction status constants
 * Represents the various states a transaction can be in during its lifecycle
 */
export const TransactionStatus = {
  IDLE: 'IDLE',
  PENDING_SIGNATURE: 'PENDING_SIGNATURE',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const

export type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus]

/**
 * Transaction error type constants
 * Categorizes different types of errors that can occur during transactions
 */
export const TransactionErrorType = {
  USER_REJECTED: 'USER_REJECTED',
  INSUFFICIENT_GAS: 'INSUFFICIENT_GAS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONTRACT_REVERT: 'CONTRACT_REVERT',
  WRONG_NETWORK: 'WRONG_NETWORK',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type TransactionErrorType = typeof TransactionErrorType[keyof typeof TransactionErrorType]

/**
 * Structured transaction error information
 */
export interface TransactionError {
  /** Error type categorization */
  type: TransactionErrorType
  /** Human-readable error message */
  message: string
  /** Original error object for debugging */
  originalError?: Error
  /** Whether the error is recoverable (user can retry) */
  recoverable: boolean
}

/**
 * Transaction state information
 * Contains all the state needed to track and display a transaction
 */
export interface TransactionState {
  /** Current status of the transaction */
  status: TransactionStatus
  /** Transaction hash (available after signature) */
  hash?: Hash
  /** Error information if transaction failed */
  error?: TransactionError
  /** Whether transaction is currently being processed */
  isPending: boolean
  /** Whether transaction is waiting for block confirmation */
  isConfirming: boolean
  /** Whether transaction completed successfully */
  isSuccess: boolean
  /** Whether transaction failed */
  isError: boolean
}

/**
 * Transaction result from wagmi hooks
 */
export interface TransactionResult {
  /** Transaction hash */
  hash?: Hash
  /** Whether write is pending (waiting for signature) */
  isPending: boolean
  /** Whether receipt is being confirmed (waiting for block) */
  isConfirming: boolean
  /** Whether transaction succeeded */
  isSuccess: boolean
  /** Error if transaction failed */
  error?: Error
}

/**
 * Hook return type for transaction operations
 */
export interface UseTransactionReturn {
  /** Current transaction state */
  state: TransactionState
  /** Execute a transaction */
  execute: () => Promise<void>
  /** Reset transaction state to idle */
  reset: () => void
  /** Retry failed transaction */
  retry: () => Promise<void>
}
