import type { TokenRowProps } from '../../types/vault';

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
            Balance {token.balance.toFixed(2)} (${token.balanceUsd.toFixed(2)})
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