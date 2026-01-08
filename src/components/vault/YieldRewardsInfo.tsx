import { formatUnits } from 'viem';
import type { YieldRewardsInfoProps } from '../../types/vault';

/**
 * YieldRewardsInfo Component
 *
 * Displays yield APY breakdown (PhUSD fixed + USDC variable) and pending rewards
 * for the connected user. Used in the ContextBox for Deposit and Withdraw tabs.
 */
export default function YieldRewardsInfo({
  totalApy,
  phUsdApy,
  usdcApy,
  pendingPhUsd,
  pendingUsdc,
  isLoading = false,
  isConnected = false
}: YieldRewardsInfoProps) {
  // Format pending rewards - handle both bigint and string types
  const formatPendingAmount = (amount: bigint | string): string => {
    if (typeof amount === 'bigint') {
      // Convert from 18 decimal wei to human-readable format
      const formatted = parseFloat(formatUnits(amount, 18));
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
      {/* APY Breakdown Section */}
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-lg font-semibold text-card-foreground">Yield APY</h3>
          <span className="text-2xl font-bold text-pxusd-yellow-400">
            {formatApy(totalApy)}%
          </span>
        </div>

        <div className="space-y-3">
          {/* PhUSD APY Line */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground">phUSD</span>
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-pxusd-teal-700 text-pxusd-teal-300 border border-pxusd-teal-600">
                Fixed
              </span>
            </div>
            <span className="text-sm font-medium text-card-foreground">
              {formatApy(phUsdApy)}%
            </span>
          </div>

          {/* USDC APY Line */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground">USDC</span>
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-pxusd-orange-900/30 text-pxusd-orange-300 border border-pxusd-orange-500/50">
                Variable
              </span>
            </div>
            <span className="text-sm font-medium text-card-foreground">
              {formatApy(usdcApy)}%
            </span>
          </div>
        </div>

        {/* APY Explanation */}
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          Fixed APY is guaranteed regardless of total deposits. Variable APY adjusts based on total staked amount.
        </p>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-border" />

      {/* Pending Rewards Section */}
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
              <span className="text-sm text-foreground">phUSD</span>
              <span className="text-sm font-medium text-pxusd-yellow-400">
                {formatPendingAmount(pendingPhUsd)} phUSD
              </span>
            </div>

            {/* USDC Pending Rewards */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">USDC</span>
              <span className="text-sm font-medium text-pxusd-yellow-400">
                {formatPendingAmount(pendingUsdc)} USDC
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
