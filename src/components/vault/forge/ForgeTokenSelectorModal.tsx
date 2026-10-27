import { useEffect } from 'react';
import { fmt2 } from './forgeFormat';

export interface ForgeTokenOption<S extends string = string> {
  symbol: S;
  name: string;
  icon: string;
  balance: number;
}

interface ForgeTokenSelectorModalProps<S extends string> {
  isOpen: boolean;
  onClose: () => void;
  tokens: readonly ForgeTokenOption<S>[];
  activeSymbol: S;
  onSelect: (symbol: S) => void;
  footerNote?: string;
}

/**
 * Forge-local copy of `ui/TokenSelectorModal`. The shared modal shows each
 * token's contract address, which a mock surface has no chain-free source for
 * (and must not hardcode), and it has no footer slot. Classes are copied
 * verbatim except the active-row tint, which is literal rgba because the
 * shared modal's teal-900 opacity-modifier class emits no CSS.
 */
export default function ForgeTokenSelectorModal<S extends string>({
  isOpen,
  onClose,
  tokens,
  activeSymbol,
  onSelect,
  footerNote,
}: ForgeTokenSelectorModalProps<S>) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="forge-token-selector-title"
    >
      <div
        className="bg-background border border-border rounded-lg max-w-md w-full p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="forge-token-selector-title" className="text-lg font-semibold text-foreground mb-3">
          Select a token
        </h2>
        <div className="flex flex-col gap-2">
          {tokens.map((token) => {
            const isActive = token.symbol === activeSymbol;
            return (
              <button
                key={token.symbol}
                type="button"
                onClick={() => {
                  onSelect(token.symbol);
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors hover:bg-pxusd-teal-700 focus:outline-none focus:ring-2 focus:ring-primary ${
                  isActive ? 'border-primary' : 'border-border bg-card'
                }`}
                style={isActive ? { background: 'rgba(5,14,22,.4)' } : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={token.icon}
                    alt={`${token.symbol} icon`}
                    className="h-10 w-10 rounded-full flex-shrink-0 object-cover"
                  />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-base font-semibold text-foreground truncate">{token.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate">{token.name}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  {/* Stablecoins: $ value is 1:1 with balance, as in the shared modal. */}
                  <span className="text-base font-semibold text-foreground">${fmt2(token.balance)}</span>
                  <span className="text-xs text-muted-foreground">{fmt2(token.balance)}</span>
                </div>
              </button>
            );
          })}
        </div>
        {footerNote && <p className="mt-3 text-xs text-muted-foreground">{footerNote}</p>}
      </div>
    </div>
  );
}
