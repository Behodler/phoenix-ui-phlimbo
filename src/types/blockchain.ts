export interface TokenBalance {
  symbol: string;
  balance: number;
  balanceUsd: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'mint' | 'burn';
  status: 'pending' | 'success' | 'failed';
  tokenIn?: TokenBalance;
  tokenOut?: TokenBalance;
  amount: number;
  timestamp: number;
  gasUsed?: number;
  gasFeeUsd?: number;
}

export interface MockBlockchainState {
  balances: Record<string, TokenBalance>;
  transactions: Transaction[];
  isConnected: boolean;
  isLoading: boolean;
  error?: string;
}

export interface MockBlockchainActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  executeTransaction: (transaction: Omit<Transaction, 'id' | 'timestamp' | 'status'>) => Promise<Transaction>;
  updateBalance: (symbol: string, balance: Partial<TokenBalance>) => void;
  clearError: () => void;
}

export interface MockBlockchainContext extends MockBlockchainState, MockBlockchainActions {}