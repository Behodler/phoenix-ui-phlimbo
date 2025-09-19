import type { TokenRowProps } from '../../types/vault';

export default function TokenRow({ token, onMaxClick }: TokenRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-400 to-purple-600" />
        <div>
          <div className="text-base font-semibold">{token.name}</div>
          <div className="text-sm text-neutral-400">
            Balance {token.balance.toFixed(2)} (${token.balanceUsd.toFixed(2)})
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400">MAX</span>
        <button
          onClick={onMaxClick}
          className="rounded-lg border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
        >
          0%
        </button>
      </div>
    </div>
  );
}