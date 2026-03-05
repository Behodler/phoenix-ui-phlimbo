import type { NFTData } from '../../data/nftMockData';

interface NFTCardProps {
  nft: NFTData;
  onMintClick: (nft: NFTData) => void;
}

export default function NFTCard({ nft, onMintClick }: NFTCardProps) {
  return (
    <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg overflow-hidden hover:border-pxusd-orange-400/50 transition-colors">
      {/* NFT Image */}
      <div className="flex items-center justify-center p-4 bg-pxusd-teal-800/50">
        <img
          src={nft.image}
          alt={nft.name}
          className="w-24 h-24 object-contain rounded-lg"
        />
      </div>

      {/* NFT Info */}
      <div className="p-4 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{nft.name}</h3>

        <div className="space-y-1">
          <p className="text-xs text-pxusd-orange-300 font-medium uppercase tracking-wide">Action</p>
          <p className="text-sm text-foreground">{nft.action}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-pxusd-orange-300 font-medium uppercase tracking-wide">Why?</p>
          <p className="text-sm text-muted-foreground">{nft.reason}</p>
        </div>

        {/* Mock token info */}
        <div className="bg-pxusd-teal-800/50 rounded-md p-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Token:</span>
            <span className="text-foreground">{nft.tokenName}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Price:</span>
            <span className="text-foreground">${nft.mockPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Your Balance:</span>
            <span className="text-foreground">{nft.mockBalance.toLocaleString()} {nft.tokenName}</span>
          </div>
        </div>

        {/* Mint button */}
        <button
          onClick={() => onMintClick(nft)}
          className="w-full phoenix-btn-primary py-2 text-sm font-medium rounded-lg"
        >
          Mint
        </button>
      </div>
    </div>
  );
}
