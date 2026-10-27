import { useEffect, useId, type ReactNode } from 'react';
import type { ForgeNftOption } from './forgeFormat';

export interface ForgeNftPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  nfts: readonly ForgeNftOption[];
  selectedId: number;
  onSelect: (id: number) => void;
}

// Card styling copied from NFTSelectorGrid. Tints are literal rgba / arbitrary
// values: opacity modifiers on the bare-var pxusd-* tokens emit no CSS.
const SELECTED_CLASS = 'border-pxusd-orange-400 bg-pxusd-teal-700 shadow-[0_0_8px_rgba(251,146,60,0.3)]';
const HELD_CLASS = 'border-pxusd-teal-600 bg-pxusd-teal-700 cursor-pointer hover:border-[rgba(255,140,66,.5)]';
const UNHELD_CLASS = 'border-pxusd-teal-600 bg-pxusd-teal-700 opacity-40 cursor-not-allowed';

/**
 * NFT choice modal for Forge rows. List below `sm`, 3-column card grid from
 * `sm` up. NFTs the wallet does not hold are disabled. Selecting an NFT
 * closes the modal; Esc, backdrop click and × also close it. Shared by
 * Harvest Yield (089) and NFT Bonfire (090).
 */
export default function ForgeNftPickerModal({
  isOpen,
  onClose,
  title,
  footer,
  nfts,
  selectedId,
  onSelect,
}: ForgeNftPickerModalProps) {
  const titleId = useId();

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
      aria-labelledby={titleId}
    >
      <div
        className="bg-background border border-border rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:gap-3">
          {nfts.map((nft) => {
            const held = nft.held > 0;
            const selected = nft.id === selectedId;
            const stateClass = selected ? SELECTED_CLASS : held ? HELD_CLASS : UNHELD_CLASS;
            return (
              <button
                key={nft.id}
                type="button"
                disabled={!held}
                aria-pressed={selected}
                onClick={() => {
                  onSelect(nft.id);
                  onClose();
                }}
                className={`flex items-center gap-3 rounded-xl border p-2 text-left transition-colors sm:flex-col sm:gap-1.5 sm:p-3 sm:text-center ${stateClass}`}
              >
                <img
                  src={nft.image}
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-10 flex-shrink-0 rounded-[10px] object-cover sm:h-16 sm:w-16"
                />
                <span className="flex min-w-0 flex-1 flex-col sm:items-center">
                  <span className="truncate text-sm font-semibold text-foreground sm:text-xs">{nft.name}</span>
                  <span className="text-xs text-muted-foreground">#{nft.id}</span>
                </span>
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${held ? 'text-foreground' : 'text-pxusd-pink-400'}`}
                >
                  ×{nft.held}
                </span>
              </button>
            );
          })}
        </div>

        {footer && <p className="mt-3 text-xs text-muted-foreground">{footer}</p>}
      </div>
    </div>
  );
}
