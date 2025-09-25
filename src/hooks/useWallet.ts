import { useMockBlockchain } from './useMockBlockchain';

/**
 * Simplified wallet hook that provides easy access to connection state
 * and basic wallet operations for the UI components
 */
export function useWallet() {
  const { isConnected, isLoading, error, connect, disconnect, clearError } = useMockBlockchain();

  return {
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    clearError,
  };
}

export default useWallet;