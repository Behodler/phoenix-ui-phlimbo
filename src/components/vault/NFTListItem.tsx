import type { NFTData } from '../../data/nftMockData';

interface NFTListItemProps {
  nft: NFTData;
  onMintClick: (nft: NFTData) => void;
}

export default function NFTListItem({ nft, onMintClick }: NFTListItemProps) {
  return (
    <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg px-4 py-3 flex items-center gap-4 hover:border-pxusd-orange-400/50 transition-colors">
      {/* Small NFT image */}
      <img
        src={nft.image}
        alt={nft.name}
        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
      />

      {/* NFT name */}
      <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
        {nft.name}
      </span>

      {/* Mint button with price */}
      <button
        onClick={() => onMintClick(nft)}
        className="phoenix-btn-primary px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap flex-shrink-0"
      >
        Mint for {nft.mockTokenPrice.toLocaleString()} {nft.tokenName}
      </button>
    </div>
  );
}
