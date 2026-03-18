import { useEffect } from 'react';
import type { NFTData } from '../../data/nftMockData';

interface NFTSelectorGridProps {
  nfts: NFTData[];
  selectedNft: NFTData | null;
  onSelect: (nft: NFTData) => void;
  isConnected: boolean;
}

/**
 * NFT selector grid for the Yield Funnel tab.
 * Shows 5 NFT cards in a horizontal row (>=640px) or compact list (<640px).
 * Owned NFTs are selectable; unowned NFTs are dimmed and not clickable.
 * Auto-selects the first owned NFT on data load.
 */
export default function NFTSelectorGrid({
  nfts,
  selectedNft,
  onSelect,
  isConnected,
}: NFTSelectorGridProps) {
  const hasAnyOwned = nfts.some((nft) => nft.nftBalance > 0);

  // Auto-select first owned NFT when data loads
  useEffect(() => {
    if (!selectedNft && nfts.length > 0) {
      const firstOwned = nfts.find((nft) => nft.nftBalance > 0);
      if (firstOwned) {
        onSelect(firstOwned);
      }
    }
  }, [nfts, selectedNft, onSelect]);

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-foreground mb-2">
        Select NFT to Burn
      </h3>

      {/* Card row (>=640px) */}
      <div className="hidden sm:flex flex-wrap gap-3">
        {nfts.map((nft) => {
          const isOwned = nft.nftBalance > 0;
          const isSelected = selectedNft?.id === nft.id;
          const canSelect = isConnected && isOwned;

          return (
            <button
              key={nft.id}
              type="button"
              disabled={!canSelect}
              onClick={() => canSelect && onSelect(nft)}
              className={`
                flex flex-col items-center p-2 rounded-lg border transition-all min-w-[100px] flex-1
                ${isSelected
                  ? 'border-pxusd-orange-400 bg-pxusd-teal-700 shadow-[0_0_8px_rgba(251,146,60,0.3)]'
                  : isOwned
                    ? 'border-pxusd-teal-600 bg-pxusd-teal-700 hover:border-pxusd-orange-400/50 cursor-pointer'
                    : 'border-pxusd-teal-600/50 bg-pxusd-teal-700/50 opacity-40 cursor-not-allowed'
                }
              `}
            >
              <img
                src={nft.image}
                alt={nft.name}
                className="w-16 h-16 rounded-lg object-cover mb-1"
              />
              <span className="text-xs font-medium text-foreground truncate max-w-full">
                {nft.name}
              </span>
              <span className={`text-xs mt-0.5 ${isOwned ? 'text-pxusd-green-400' : 'text-muted-foreground'}`}>
                x{nft.nftBalance}
              </span>
            </button>
          );
        })}
      </div>

      {/* Compact list (<640px) */}
      <div className="flex flex-col gap-2 sm:hidden">
        {nfts.map((nft) => {
          const isOwned = nft.nftBalance > 0;
          const isSelected = selectedNft?.id === nft.id;
          const canSelect = isConnected && isOwned;

          return (
            <button
              key={nft.id}
              type="button"
              disabled={!canSelect}
              onClick={() => canSelect && onSelect(nft)}
              className={`
                flex items-center gap-3 p-2 rounded-lg border transition-all
                ${isSelected
                  ? 'border-pxusd-orange-400 bg-pxusd-teal-700 shadow-[0_0_8px_rgba(251,146,60,0.3)]'
                  : isOwned
                    ? 'border-pxusd-teal-600 bg-pxusd-teal-700 hover:border-pxusd-orange-400/50 cursor-pointer'
                    : 'border-pxusd-teal-600/50 bg-pxusd-teal-700/50 opacity-40 cursor-not-allowed'
                }
              `}
            >
              <img
                src={nft.image}
                alt={nft.name}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
              <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
                {nft.name}
              </span>
              <span className={`text-xs ${isOwned ? 'text-pxusd-green-400' : 'text-muted-foreground'}`}>
                x{nft.nftBalance}
              </span>
            </button>
          );
        })}
      </div>

      {/* No NFTs owned message */}
      {!hasAnyOwned && nfts.length > 0 && (
        <p className="text-sm text-pxusd-orange-300 mt-2">
          You need at least 1 eligible NFT to claim
        </p>
      )}
    </div>
  );
}
