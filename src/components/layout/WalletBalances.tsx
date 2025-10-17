import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useTokenBalance } from '../../hooks/useContractInteractions';

/**
 * WalletBalances Component
 *
 * Displays DOLA and phUSD token balances for the connected wallet.
 * Only renders when a wallet is connected.
 */
export default function WalletBalances() {
  const { isConnected, address: walletAddress } = useAccount();
  const { addresses } = useContractAddresses();

  // Fetch DOLA balance
  const {
    balance: dolaBalanceRaw,
    isLoading: dolaLoading,
    isError: dolaError
  } = useTokenBalance(
    walletAddress,
    addresses?.dolaToken as `0x${string}` | undefined
  );

  // Fetch phUSD balance
  const {
    balance: phUSDBalanceRaw,
    isLoading: phUSDLoading,
    isError: phUSDError
  } = useTokenBalance(
    walletAddress,
    addresses?.bondingToken as `0x${string}` | undefined
  );

  // Don't render if wallet not connected
  if (!isConnected || !walletAddress) {
    return null;
  }

  // Convert balances from wei to decimal (18 decimals)
  const dolaBalance = dolaBalanceRaw ? parseFloat(formatUnits(dolaBalanceRaw, 18)) : 0;
  const phUSDBalance = phUSDBalanceRaw ? parseFloat(formatUnits(phUSDBalanceRaw, 18)) : 0;

  // Format balance with appropriate decimals
  const formatBalance = (balance: number): string => {
    if (balance === 0) return '0.00';
    if (balance < 0.01) return balance.toFixed(4);
    if (balance < 1) return balance.toFixed(3);
    if (balance < 1000) return balance.toFixed(2);
    // Add comma separators for large numbers
    return balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="hidden sm:flex flex-col gap-1 text-right mr-3">
      {/* DOLA Balance */}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs text-muted-foreground">DOLA:</span>
        {dolaLoading ? (
          <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
        ) : dolaError ? (
          <span className="text-xs text-red-400">Error</span>
        ) : (
          <span className="text-sm font-semibold text-pxusd-white">
            {formatBalance(dolaBalance)}
          </span>
        )}
      </div>

      {/* phUSD Balance */}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs text-muted-foreground">phUSD:</span>
        {phUSDLoading ? (
          <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
        ) : phUSDError ? (
          <span className="text-xs text-red-400">Error</span>
        ) : (
          <span className="text-sm font-semibold text-pxusd-white">
            {formatBalance(phUSDBalance)}
          </span>
        )}
      </div>
    </div>
  );
}
