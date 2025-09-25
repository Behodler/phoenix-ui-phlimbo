import { useMockBlockchain } from './useMockBlockchain';
import type { TokenBalance } from '../types/blockchain';

/**
 * Hook for accessing and managing token balances
 */
export function useTokenBalance(symbol: string): {
  balance: TokenBalance | undefined;
  updateBalance: (balance: Partial<TokenBalance>) => void;
} {
  const { balances, updateBalance: updateBalanceAction } = useMockBlockchain();

  const balance = balances[symbol];

  const updateBalance = (newBalance: Partial<TokenBalance>) => {
    updateBalanceAction(symbol, newBalance);
  };

  return {
    balance,
    updateBalance,
  };
}

/**
 * Hook for getting multiple token balances at once
 */
export function useTokenBalances(symbols: string[]): Record<string, TokenBalance | undefined> {
  const { balances } = useMockBlockchain();

  return symbols.reduce((acc, symbol) => {
    acc[symbol] = balances[symbol];
    return acc;
  }, {} as Record<string, TokenBalance | undefined>);
}

export default useTokenBalance;