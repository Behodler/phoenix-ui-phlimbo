import type { TokenRowProps } from '../../types/vault';

// Format balance with appropriate decimals to avoid truncation
// This ensures balances like 9999.5 display as "9,999.50" not "10000"
const formatBalance = (balance: number): string => {
  if (balance === 0) return '0.00';
  if (balance < 0.01) return balance.toFixed(4);
  if (balance < 1) return balance.toFixed(3);
  if (balance < 1000) return balance.toFixed(2);
  // Add comma separators for large numbers
  return balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function TokenRow({ token, onMaxClick }: TokenRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <img
          src={token.icon}
          alt={`${token.name} icon`}
          className="h-10 w-10 rounded-full flex-shrink-0 object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-foreground">{token.name}</div>
          <div className="text-xs sm:text-sm text-muted-foreground break-words">
            Balance {formatBalance(token.balance)} (${formatBalance(token.balanceUsd)})
          </div>
        </div>
      </div>
      {onMaxClick && (
        <button
          onClick={onMaxClick}
          className="px-3 py-1 text-xs font-medium text-phoenix-accent border border-phoenix-accent rounded hover:bg-phoenix-accent hover:text-white transition-colors"
        >
          MAX
        </button>
      )}
    </div>
  );
}