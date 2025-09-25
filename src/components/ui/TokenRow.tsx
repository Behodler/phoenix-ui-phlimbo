import type { TokenRowProps } from '../../types/vault';

export default function TokenRow({ token, onMaxClick }: TokenRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-phoenix-accent" />
        <div>
          <div className="text-base font-semibold text-foreground">{token.name}</div>
          <div className="text-sm text-muted-foreground">
            Balance {token.balance.toFixed(2)} (${token.balanceUsd.toFixed(2)})
          </div>
        </div>
      </div>
    </div>
  );
}