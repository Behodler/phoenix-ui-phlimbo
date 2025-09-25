import { useMockBlockchain } from './useMockBlockchain';
import type { Transaction, TokenBalance } from '../types/blockchain';

/**
 * Hook for handling blockchain transactions with the mock system
 */
export function useTransaction() {
  const { executeTransaction, transactions, isLoading, error, clearError } = useMockBlockchain();

  /**
   * Execute a deposit transaction (DOLA -> pxUSD)
   */
  const executeDeposit = async (
    amount: number,
    inputToken: TokenBalance,
    outputToken: TokenBalance
  ): Promise<Transaction> => {
    return executeTransaction({
      type: 'deposit',
      amount,
      tokenIn: inputToken,
      tokenOut: outputToken,
    });
  };

  /**
   * Execute a withdraw transaction (pxUSD -> DOLA)
   */
  const executeWithdraw = async (
    amount: number,
    inputToken: TokenBalance,
    outputToken: TokenBalance
  ): Promise<Transaction> => {
    return executeTransaction({
      type: 'withdraw',
      amount,
      tokenIn: inputToken,
      tokenOut: outputToken,
    });
  };

  /**
   * Execute a mint transaction
   */
  const executeMint = async (
    amount: number,
    outputToken: TokenBalance
  ): Promise<Transaction> => {
    return executeTransaction({
      type: 'mint',
      amount,
      tokenOut: outputToken,
    });
  };

  /**
   * Execute a burn transaction
   */
  const executeBurn = async (
    amount: number,
    inputToken: TokenBalance
  ): Promise<Transaction> => {
    return executeTransaction({
      type: 'burn',
      amount,
      tokenIn: inputToken,
    });
  };

  /**
   * Get recent transactions
   */
  const getRecentTransactions = (limit = 10): Transaction[] => {
    return transactions
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  };

  /**
   * Get pending transactions
   */
  const getPendingTransactions = (): Transaction[] => {
    return transactions.filter(tx => tx.status === 'pending');
  };

  return {
    executeDeposit,
    executeWithdraw,
    executeMint,
    executeBurn,
    getRecentTransactions,
    getPendingTransactions,
    isLoading,
    error,
    clearError,
  };
}

export default useTransaction;