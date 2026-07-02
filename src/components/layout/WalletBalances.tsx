import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useWalletBalances } from '../../contexts/WalletBalancesContext';

/**
 * WalletBalances Component
 *
 * Displays DOLA, phUSD, USDC, and USDe token balances for the connected wallet.
 * Consumes balances from WalletBalancesContext for centralized refresh support.
 * Rendered as a compact horizontal row (wide/desktop screens only), all values
 * formatted to 2 decimal places. Only renders when a wallet is connected.
 */
export default function WalletBalances() {
  const { isConnected, address: walletAddress } = useAccount();

  // Get balances from context (moved from local useTokenBalance hooks)
  const {
    dolaBalanceRaw,
    phUsdBalanceRaw,
    usdcBalanceRaw,
    usdeBalanceRaw,
    dolaLoading,
    phUsdLoading,
    usdcLoading,
    usdeLoading,
    dolaError,
    phUsdError,
    usdcError,
    usdeError
  } = useWalletBalances();

  // Don't render if wallet not connected
  if (!isConnected || !walletAddress) {
    return null;
  }

  // Convert balances from wei to decimal (18 decimals for DOLA/phUSD/USDe, 6 for USDC)
  const dolaBalance = dolaBalanceRaw ? parseFloat(formatUnits(dolaBalanceRaw, 18)) : 0;
  const phUSDBalance = phUsdBalanceRaw ? parseFloat(formatUnits(phUsdBalanceRaw, 18)) : 0;
  const usdcBalance = usdcBalanceRaw ? parseFloat(formatUnits(usdcBalanceRaw, 6)) : 0;
  const usdeBalance = usdeBalanceRaw ? parseFloat(formatUnits(usdeBalanceRaw, 18)) : 0;

  // Format every balance to exactly 2 decimal places (with comma separators).
  const formatBalance = (balance: number): string =>
    balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderItem = (
    label: string,
    balance: number,
    loading: boolean,
    error: boolean
  ) => (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      {loading ? (
        <span className="text-[10px] text-muted-foreground animate-pulse">Loading...</span>
      ) : error ? (
        <span className="text-[10px] text-red-400">Error</span>
      ) : (
        <span className="text-xs font-semibold text-pxusd-white">
          {formatBalance(balance)}
        </span>
      )}
    </div>
  );

  return (
    <div className="hidden lg:flex flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {renderItem('DOLA', dolaBalance, dolaLoading, dolaError)}
      {renderItem('phUSD', phUSDBalance, phUsdLoading, phUsdError)}
      {renderItem('USDC', usdcBalance, usdcLoading, usdcError)}
      {renderItem('USDe', usdeBalance, usdeLoading, usdeError)}
    </div>
  );
}
