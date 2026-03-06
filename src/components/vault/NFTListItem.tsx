import type { NFTData } from '../../data/nftMockData';

interface NFTListItemProps {
  nft: NFTData;
  onMintClick: (nft: NFTData) => void;
}

export default function NFTListItem({ nft, onMintClick }: NFTListItemProps) {
  const dollarValue = (nft.mockTokenPrice * nft.mockPrice).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg px-4 flex items-center hover:border-pxusd-orange-400/50 transition-colors text-xs min-h-[3.5rem]">
      {/* Small NFT image */}
      <img
        src={nft.image}
        alt={nft.name}
        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
      />

      {/* NFT name */}
      <span className="font-medium text-foreground flex-1 min-w-0 pl-3">
        {nft.name}
      </span>

      {/* Action */}
      <span className="hidden sm:inline text-muted-foreground flex-1 min-w-0 leading-tight">
        {nft.action}
      </span>

      {/* Price */}
      <span className="text-foreground w-[5rem] sm:w-[12rem] min-w-0 text-right pr-4">
        <span className="truncate">{nft.mockTokenPrice.toLocaleString()} {nft.tokenName}</span>
        <span className="block sm:inline text-muted-foreground"> (${dollarValue})</span>
      </span>

      {/* Mint button */}
      <button
        onClick={() => onMintClick(nft)}
        className="phoenix-btn-primary !px-4 !py-2 font-medium !rounded-[4px] whitespace-nowrap flex-shrink-0"
      >
        Mint
      </button>
    </div>
  );
}
