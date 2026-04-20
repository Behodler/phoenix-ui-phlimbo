import { formatUnits } from 'viem';
import type { YieldRewardsInfoProps } from '../../types/vault';
import phUsdLogo from '../../assets/phUSD-nobackground.png';
import usdcLogo from '../../assets/usdc-logo.svg';

/**
 * YieldRewardsInfo Component
 *
 * Displays yield APY breakdown (PhUSD fixed + USDC variable), pending rewards
 * with claim button, and staked balance for the connected user.
 * Used in the ContextBox for Deposit and Withdraw tabs.
 */
export default function YieldRewardsInfo({
  totalApy,
  usdcApy,
  pendingPhUsd,
  pendingUsdc,
  stakedBalance,
  isLoading = false,
  isConnected = false,
  onClaim,
  isClaiming = false,
  isUsdcDecimals6 = false
}: YieldRewardsInfoProps) {
  // Format pending rewards - handle both bigint and string types
  // decimals: number of decimal places for the token (18 for phUSD/DOLA, 6 for USDC)
  const formatPendingAmount = (amount: bigint | string, decimals: number = 18): string => {
    if (typeof amount === 'bigint') {
      // Convert from specified decimal wei to human-readable format
      const formatted = parseFloat(formatUnits(amount, decimals));
      return formatted.toFixed(2);
    }
    // Already a string - parse and format
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
  };

  // Format APY percentage with 1 decimal place
  const formatApy = (apy: number): string => {
    return apy.toFixed(1);
  };

  // Check if an amount is non-zero
  const isNonZero = (amount: bigint | string): boolean => {
    if (typeof amount === 'bigint') {
      return amount > 0n;
    }
    const parsed = parseFloat(amount);
    return !isNaN(parsed) && parsed > 0;
  };

  // Determine if sections should show
  const hasPendingRewards = isNonZero(pendingPhUsd) || isNonZero(pendingUsdc);
  const hasStakedBalance = isNonZero(stakedBalance);
  const hasNoRewardsToClaim = !isNonZero(pendingPhUsd) && !isNonZero(pendingUsdc);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* APY Skeleton */}
        <div className="space-y-3">
          <div className="h-6 bg-border/50 rounded w-32" />
          <div className="h-4 bg-border/50 rounded w-full" />
          <div className="h-4 bg-border/50 rounded w-full" />
        </div>
        {/* Rewards Skeleton */}
        <div className="space-y-3">
          <div className="h-6 bg-border/50 rounded w-40" />
          <div className="h-4 bg-border/50 rounded w-3/4" />
          <div className="h-4 bg-border/50 rounded w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* APY Breakdown Section - Always renders */}
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-lg font-semibold text-card-foreground">Yield APY</h3>
          <span className="text-2xl font-bold text-pxusd-yellow-400">
            {formatApy(totalApy)}%
          </span>
        </div>

        <div className="space-y-3">
          {/* USDC APY Line */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={usdcLogo} alt="USDC" className="w-5 h-5 rounded-full" />
              <span className="text-sm text-foreground">USDC</span>
            </div>
            <span className="text-sm font-medium text-card-foreground">
              {formatApy(usdcApy)}%
            </span>
          </div>
        </div>
      </div>

      {/* Pending Rewards Section - Only renders when pendingPhUsd OR pendingUsdc is non-zero */}
      {hasPendingRewards && (
        <>
          {/* Divider */}
          <div className="h-px w-full bg-border" />

          <div>
            <h3 className="text-lg font-semibold text-card-foreground mb-4">
              Pending Rewards
            </h3>

            {!isConnected ? (
              <p className="text-sm text-muted-foreground">
                Connect wallet to view your pending rewards
              </p>
            ) : (
              <div className="space-y-3">
                {/* PhUSD Pending Rewards */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <img src={phUsdLogo} alt="phUSD" className="w-5 h-5 rounded-full" />
                    <span className="text-sm text-foreground">phUSD</span>
                  </div>
                  <span className="text-sm font-medium text-pxusd-yellow-400">
                    {formatPendingAmount(pendingPhUsd)} phUSD
                  </span>
                </div>

                {/* USDC Pending Rewards */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <img src={usdcLogo} alt="USDC" className="w-5 h-5 rounded-full" />
                    <span className="text-sm text-foreground">USDC</span>
                  </div>
                  <span className="text-sm font-medium text-pxusd-yellow-400">
                    {formatPendingAmount(pendingUsdc, isUsdcDecimals6 ? 6 : 18)} USDC
                  </span>
                </div>

                {/* Claim Button */}
                <button
                  onClick={onClaim}
                  disabled={hasNoRewardsToClaim || isClaiming}
                  className="w-full mt-4 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    bg-pxusd-yellow-400 text-gray-900 hover:bg-pxusd-yellow-300
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-pxusd-yellow-400"
                >
                  {isClaiming ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Claiming...
                    </span>
                  ) : (
                    'Claim'
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Your Staked Balance Section - Only renders when stakedBalance is non-zero */}
      {hasStakedBalance && (
        <>
          {/* Divider */}
          <div className="h-px w-full bg-border" />

          <div>
            <h3 className="text-lg font-semibold text-card-foreground mb-4">
              Your Staked Balance
            </h3>

            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">phUSD</span>
              <span className="text-sm font-medium text-pxusd-yellow-400">
                {formatPendingAmount(stakedBalance)} phUSD
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
