import { TransactionErrorType, type TransactionError } from '../types/transaction'
import {
  isStaleConnectorError,
  STALE_CONNECTOR_MESSAGE,
  STALE_CONNECTOR_TITLE,
} from './walletConnectionErrors'

/**
 * Parses a transaction error and categorizes it
 *
 * @param error - The error object from wagmi or viem
 * @returns Structured transaction error with type, message, and recoverability
 */
export function parseTransactionError(error: Error): TransactionError {
  const errorMessage = error.message.toLowerCase()

  // Stale wallet connection — must be checked before the WRONG_NETWORK branch
  // below, whose 'chain' substring test otherwise swallows
  // "connector.getChainId is not a function" and tells the user to switch
  // networks, which cannot fix it. Not recoverable: retrying re-runs against
  // the same inert connector. See utils/walletConnectionErrors.ts.
  if (isStaleConnectorError(error)) {
    return {
      type: TransactionErrorType.WALLET_DISCONNECTED,
      message: STALE_CONNECTOR_MESSAGE,
      originalError: error,
      recoverable: false,
    }
  }

  // User rejected transaction in wallet
  if (
    errorMessage.includes('user rejected') ||
    errorMessage.includes('user denied') ||
    errorMessage.includes('user cancelled') ||
    errorMessage.includes('rejected by user')
  ) {
    return {
      type: TransactionErrorType.USER_REJECTED,
      message: 'Transaction was cancelled. Please try again when ready.',
      originalError: error,
      recoverable: true,
    }
  }

  // Insufficient gas
  if (
    errorMessage.includes('insufficient funds') ||
    errorMessage.includes('insufficient gas') ||
    errorMessage.includes('out of gas')
  ) {
    return {
      type: TransactionErrorType.INSUFFICIENT_GAS,
      message: 'Insufficient gas to complete transaction. Please add funds to your wallet.',
      originalError: error,
      recoverable: true,
    }
  }

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('fetch failed')
  ) {
    return {
      type: TransactionErrorType.NETWORK_ERROR,
      message: 'Network error occurred. Please check your connection and try again.',
      originalError: error,
      recoverable: true,
    }
  }

  // Wrong network
  if (
    errorMessage.includes('chain') ||
    errorMessage.includes('network mismatch') ||
    errorMessage.includes('unsupported chain')
  ) {
    return {
      type: TransactionErrorType.WRONG_NETWORK,
      message: 'Please switch to the correct network in your wallet.',
      originalError: error,
      recoverable: true,
    }
  }

  // Contract revert
  if (
    errorMessage.includes('revert') ||
    errorMessage.includes('execution reverted') ||
    errorMessage.includes('transaction failed')
  ) {
    return {
      type: TransactionErrorType.CONTRACT_REVERT,
      message: 'Transaction was reverted by the smart contract. Please check your inputs and try again.',
      originalError: error,
      recoverable: true,
    }
  }

  // Unknown error - catch all
  return {
    type: TransactionErrorType.UNKNOWN_ERROR,
    message: `Transaction failed: ${error.message}`,
    originalError: error,
    recoverable: true,
  }
}

/**
 * Gets a user-friendly title for a transaction error type
 *
 * @param errorType - The transaction error type
 * @returns Human-readable error title
 */
export function getErrorTitle(errorType: TransactionErrorType): string {
  switch (errorType) {
    case TransactionErrorType.USER_REJECTED:
      return 'Transaction Cancelled'
    case TransactionErrorType.INSUFFICIENT_GAS:
      return 'Insufficient Gas'
    case TransactionErrorType.NETWORK_ERROR:
      return 'Network Error'
    case TransactionErrorType.CONTRACT_REVERT:
      return 'Transaction Failed'
    case TransactionErrorType.WRONG_NETWORK:
      return 'Wrong Network'
    case TransactionErrorType.WALLET_DISCONNECTED:
      return STALE_CONNECTOR_TITLE
    case TransactionErrorType.UNKNOWN_ERROR:
      return 'Transaction Error'
    default:
      return 'Error'
  }
}

/**
 * Determines if an error should show a retry button
 *
 * @param errorType - The transaction error type
 * @returns Whether retry should be offered
 */
export function shouldOfferRetry(errorType: TransactionErrorType): boolean {
  // No retry for user cancellation, nor for a stale connection — the latter
  // fails identically on every attempt until the wallet is reconnected.
  return (
    errorType !== TransactionErrorType.USER_REJECTED &&
    errorType !== TransactionErrorType.WALLET_DISCONNECTED
  )
}
