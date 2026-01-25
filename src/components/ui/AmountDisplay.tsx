import type { AmountDisplayProps } from '../../types/vault';

/**
 * Displays a numeric amount with optional dollar estimate
 *
 * @param amount - The token amount to display
 * @param showDollarEstimate - If true, shows dollar value below the amount
 * @param priceMultiplier - Optional price multiplier for dollar estimate (e.g., phUSD market price).
 *                          Defaults to 1.0 (1:1 ratio). On mainnet, pass the actual market price
 *                          to display accurate USD values.
 */
export default function AmountDisplay({
  amount,
  showDollarEstimate = false,
  priceMultiplier = 1.0
}: AmountDisplayProps) {
  // Format number with up to 6 significant decimals, removing trailing zeros
  const formatAmount = (num: number) => {
    if (num === 0) return '0';
    // Convert to string with high precision, then remove trailing zeros
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 18, // Allow full precision
      useGrouping: true
    });
    return formatted;
  };

  // Calculate dollar value using the price multiplier
  const dollarValue = amount * priceMultiplier;

  return (
    <div className="mb-6">
      <div className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-foreground">
        {formatAmount(amount)}
      </div>
      {showDollarEstimate && (
        <div className="text-sm text-muted-foreground">
          ${formatAmount(dollarValue)}
        </div>
      )}
    </div>
  );
}