import type { AmountDisplayProps } from '../../types/vault';

export default function AmountDisplay({ amount }: AmountDisplayProps) {
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

  return (
    <div className="mb-6">
      <div className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-foreground">
        {formatAmount(amount)}
      </div>
    </div>
  );
}