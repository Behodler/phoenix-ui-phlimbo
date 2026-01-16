import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useWalletBalances } from '../../contexts/WalletBalancesContext';

/**
 * WalletBalances Component
 *
 * Displays DOLA, phUSD, and USDC token balances for the connected wallet.
 * Now consumes balances from WalletBalancesContext for centralized refresh support.
 * Only renders when a wallet is connected.
 */
export default function WalletBalances() {
  const { isConnected, address: walletAddress } = useAccount();

  // Get balances from context (moved from local useTokenBalance hooks)
  const {
    dolaBalanceRaw,
    phUsdBalanceRaw,
    usdcBalanceRaw,
    dolaLoading,
    phUsdLoading,
    usdcLoading,
    dolaError,
    phUsdError,
    usdcError
  } = useWalletBalances();

  // Don't render if wallet not connected
  if (!isConnected || !walletAddress) {
    return null;
  }

  // Convert balances from wei to decimal (18 decimals for DOLA/phUSD, 6 decimals for USDC)
  const dolaBalance = dolaBalanceRaw ? parseFloat(formatUnits(dolaBalanceRaw, 18)) : 0;
  const phUSDBalance = phUsdBalanceRaw ? parseFloat(formatUnits(phUsdBalanceRaw, 18)) : 0;
  const usdcBalance = usdcBalanceRaw ? parseFloat(formatUnits(usdcBalanceRaw, 6)) : 0;

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
        {phUsdLoading ? (
          <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
        ) : phUsdError ? (
          <span className="text-xs text-red-400">Error</span>
        ) : (
          <span className="text-sm font-semibold text-pxusd-white">
            {formatBalance(phUSDBalance)}
          </span>
        )}
      </div>

      {/* USDC Balance */}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-xs text-muted-foreground">USDC:</span>
        {usdcLoading ? (
          <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
        ) : usdcError ? (
          <span className="text-xs text-red-400">Error</span>
        ) : (
          <span className="text-sm font-semibold text-pxusd-white">
            {formatBalance(usdcBalance)}
          </span>
        )}
      </div>
    </div>
  );
}
