import { useEffect } from 'react';
import type { MintTokenConfig, MintTokenSymbol } from '../../pages/VaultPage';

interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: MintTokenConfig[];
  activeSymbol: MintTokenSymbol;
  onSelect: (symbol: MintTokenSymbol) => void;
}

// Format a balance number using the same rules as MintForm's formatBalance helper
function formatBalance(balance: number): string {
  if (balance === 0) return '0.00';
  if (balance < 0.01) return balance.toFixed(4);
  if (balance < 1) return balance.toFixed(3);
  if (balance < 1000) return balance.toFixed(2);
  return balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Truncate an address like 0x865C...7DA3. Returns a placeholder dash if undefined/empty.
function truncateAddress(address: string | undefined): string {
  if (!address || address.length < 10) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function TokenSelectorModal({
  isOpen,
  onClose,
  tokens,
  activeSymbol,
  onSelect,
}: TokenSelectorModalProps) {
  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (symbol: MintTokenSymbol) => {
    onSelect(symbol);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="token-selector-title"
    >
      <div
        className="bg-background border border-border rounded-lg max-w-md w-full p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="token-selector-title"
          className="text-lg font-semibold text-foreground mb-3"
        >
          Select a token
        </h2>
        <div className="flex flex-col gap-2">
          {tokens.map((token) => {
            const isActive = token.symbol === activeSymbol;
            return (
              <button
                key={token.symbol}
                type="button"
                onClick={() => handleSelect(token.symbol)}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors hover:bg-pxusd-teal-700 focus:outline-none focus:ring-2 focus:ring-primary ${
                  isActive
                    ? 'border-primary bg-pxusd-teal-900/40'
                    : 'border-border bg-card'
                }`}
              >
                {/* Left section: icon + name/symbol-address */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={token.icon}
                    alt={`${token.symbol} icon`}
                    className="h-10 w-10 rounded-full flex-shrink-0 object-cover"
                  />
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-base font-semibold text-foreground truncate">
                      {token.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {token.symbol}&nbsp;&nbsp;{truncateAddress(token.address)}
                    </span>
                  </div>
                </div>

                {/* Right section: dollar value + balance */}
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-base font-semibold text-foreground">
                    ${formatBalance(token.balanceUsd)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatBalance(token.balance)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { TokenSelectorModal };
