import type { NFTData } from '../../data/nftMockData';

interface NFTListItemProps {
  nft: NFTData;
  onMintClick: (nft: NFTData) => void;
}

export default function NFTListItem({ nft, onMintClick }: NFTListItemProps) {
  const dollarValue = (nft.mockTokenPrice * nft.mockPrice).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg px-4 py-2 flex items-center hover:border-pxusd-orange-400/50 transition-colors text-xs">
      {/* Small NFT image */}
      <img
        src={nft.image}
        alt={nft.name}
        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
      />

      {/* NFT name */}
      <span className="font-medium text-foreground w-[11rem] min-w-0 truncate pl-3">
        {nft.name}
      </span>

      {/* Action */}
      <span className="text-muted-foreground w-[16rem] min-w-0 truncate">
        {nft.action}
      </span>

      {/* Price */}
      <span className="text-foreground w-[12rem] min-w-0 truncate text-right pr-4">
        {nft.mockTokenPrice.toLocaleString()} {nft.tokenName} (${dollarValue})
      </span>

      {/* Mint button */}
      <button
        onClick={() => onMintClick(nft)}
        className="phoenix-btn-primary px-2 py-0.5 font-medium rounded-sm whitespace-nowrap flex-shrink-0 ml-auto"
      >
        Mint6
      </button>
    </div>
  );
}
