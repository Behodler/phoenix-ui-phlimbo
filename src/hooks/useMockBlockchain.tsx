import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { MockBlockchainState, MockBlockchainContext, Transaction, TokenBalance } from '../types/blockchain';

// Initial state with mock token balances
const initialState: MockBlockchainState = {
  balances: {
    'DOLA': {
      symbol: 'DOLA',
      balance: 1000.0,
      balanceUsd: 1000.0,
    },
    'pxUSD': {
      symbol: 'pxUSD',
      balance: 0.0,
      balanceUsd: 0.0,
    },
  },
  transactions: [],
  isConnected: false,
  isLoading: false,
  error: undefined,
};

// Action types
type BlockchainAction =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS' }
  | { type: 'CONNECT_ERROR'; payload: string }
  | { type: 'DISCONNECT' }
  | { type: 'TRANSACTION_START'; payload: Transaction }
  | { type: 'TRANSACTION_SUCCESS'; payload: Transaction }
  | { type: 'TRANSACTION_ERROR'; payload: { id: string; error: string } }
  | { type: 'UPDATE_BALANCE'; payload: { symbol: string; balance: Partial<TokenBalance> } }
  | { type: 'CLEAR_ERROR' };

// Reducer
function blockchainReducer(state: MockBlockchainState, action: BlockchainAction): MockBlockchainState {
  switch (action.type) {
    case 'CONNECT_START':
      return { ...state, isLoading: true, error: undefined };

    case 'CONNECT_SUCCESS':
      return { ...state, isConnected: true, isLoading: false, error: undefined };

    case 'CONNECT_ERROR':
      return { ...state, isConnected: false, isLoading: false, error: action.payload };

    case 'DISCONNECT':
      return { ...state, isConnected: false, error: undefined };

    case 'TRANSACTION_START':
      return {
        ...state,
        transactions: [...state.transactions, action.payload],
        isLoading: true,
        error: undefined,
      };

    case 'TRANSACTION_SUCCESS':
      return {
        ...state,
        transactions: state.transactions.map(tx =>
          tx.id === action.payload.id ? action.payload : tx
        ),
        isLoading: false,
        error: undefined,
      };

    case 'TRANSACTION_ERROR':
      return {
        ...state,
        transactions: state.transactions.map(tx =>
          tx.id === action.payload.id
            ? { ...tx, status: 'failed' as const }
            : tx
        ),
        isLoading: false,
        error: action.payload.error,
      };

    case 'UPDATE_BALANCE':
      return {
        ...state,
        balances: {
          ...state.balances,
          [action.payload.symbol]: {
            ...state.balances[action.payload.symbol],
            ...action.payload.balance,
          },
        },
      };

    case 'CLEAR_ERROR':
      return { ...state, error: undefined };

    default:
      return state;
  }
}

// Context
const MockBlockchainContext = createContext<MockBlockchainContext | null>(null);

// Provider component
export function MockBlockchainProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(blockchainReducer, initialState);

  // Actions
  const connect = async (): Promise<void> => {
    dispatch({ type: 'CONNECT_START' });

    // Simulate connection delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate occasional connection failures for realism
        if (Math.random() > 0.9) {
          const error = 'Failed to connect to wallet';
          dispatch({ type: 'CONNECT_ERROR', payload: error });
          reject(new Error(error));
        } else {
          dispatch({ type: 'CONNECT_SUCCESS' });
          resolve();
        }
      }, 1500); // 1.5 second connection delay
    });
  };

  const disconnect = (): void => {
    dispatch({ type: 'DISCONNECT' });
  };

  const executeTransaction = async (
    transactionData: Omit<Transaction, 'id' | 'timestamp' | 'status'>
  ): Promise<Transaction> => {
    const transaction: Transaction = {
      ...transactionData,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: 'pending',
      gasUsed: Math.floor(Math.random() * 50000) + 21000, // Random gas between 21k-71k
      gasFeeUsd: Math.random() * 2 + 0.1, // Random fee between $0.1-$2.1
    };

    dispatch({ type: 'TRANSACTION_START', payload: transaction });

    // Simulate transaction processing with realistic delay
    return new Promise((resolve, reject) => {
      const delay = Math.random() * 2000 + 1000; // 1-3 second delay

      setTimeout(() => {
        // Simulate occasional transaction failures for realism
        if (Math.random() > 0.95) {
          const error = 'Transaction failed: Insufficient gas or network error';
          dispatch({ type: 'TRANSACTION_ERROR', payload: { id: transaction.id, error } });
          reject(new Error(error));
          return;
        }

        // Update balances based on transaction type
        if (transaction.type === 'deposit' && transaction.tokenIn && transaction.tokenOut) {
          // For deposit: decrease input token, increase output token
          const inputBalance = state.balances[transaction.tokenIn.symbol];
          const outputBalance = state.balances[transaction.tokenOut.symbol];

          if (inputBalance && outputBalance) {
            dispatch({
              type: 'UPDATE_BALANCE',
              payload: {
                symbol: transaction.tokenIn.symbol,
                balance: {
                  balance: Math.max(0, inputBalance.balance - transaction.amount),
                  balanceUsd: Math.max(0, inputBalance.balanceUsd - transaction.amount),
                },
              },
            });

            // For deposit: assume 1:1 rate for simplicity, minus small slippage
            const outputAmount = transaction.amount * 0.998; // 0.2% slippage
            dispatch({
              type: 'UPDATE_BALANCE',
              payload: {
                symbol: transaction.tokenOut.symbol,
                balance: {
                  balance: outputBalance.balance + outputAmount,
                  balanceUsd: outputBalance.balanceUsd + outputAmount,
                },
              },
            });
          }
        }

        // Handle withdraw transactions
        if (transaction.type === 'withdraw' && transaction.tokenIn && transaction.tokenOut) {
          // For withdraw: decrease input token (pxUSD), increase output token (DOLA)
          const inputBalance = state.balances[transaction.tokenIn.symbol];
          const outputBalance = state.balances[transaction.tokenOut.symbol];

          if (inputBalance && outputBalance) {
            // Decrease input token balance
            dispatch({
              type: 'UPDATE_BALANCE',
              payload: {
                symbol: transaction.tokenIn.symbol,
                balance: {
                  balance: Math.max(0, inputBalance.balance - transaction.amount),
                  balanceUsd: Math.max(0, inputBalance.balanceUsd - transaction.amount),
                },
              },
            });

            // For withdraw: apply 2% fee as per story requirements
            const outputAmount = transaction.amount * 0.98; // 2% fee deduction
            dispatch({
              type: 'UPDATE_BALANCE',
              payload: {
                symbol: transaction.tokenOut.symbol,
                balance: {
                  balance: outputBalance.balance + outputAmount,
                  balanceUsd: outputBalance.balanceUsd + outputAmount,
                },
              },
            });
          }
        }

        const successTransaction = { ...transaction, status: 'success' as const };
        dispatch({ type: 'TRANSACTION_SUCCESS', payload: successTransaction });
        resolve(successTransaction);
      }, delay);
    });
  };

  const updateBalance = (symbol: string, balance: Partial<TokenBalance>): void => {
    dispatch({ type: 'UPDATE_BALANCE', payload: { symbol, balance } });
  };

  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const contextValue: MockBlockchainContext = {
    ...state,
    connect,
    disconnect,
    executeTransaction,
    updateBalance,
    clearError,
  };

  return (
    <MockBlockchainContext.Provider value={contextValue}>
      {children}
    </MockBlockchainContext.Provider>
  );
}

// Hook
export function useMockBlockchain(): MockBlockchainContext {
  const context = useContext(MockBlockchainContext);
  if (!context) {
    throw new Error('useMockBlockchain must be used within a MockBlockchainProvider');
  }
  return context;
}

export default useMockBlockchain;