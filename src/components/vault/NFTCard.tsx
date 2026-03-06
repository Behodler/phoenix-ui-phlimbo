import type { NFTData } from '../../data/nftMockData';

interface NFTCardProps {
  nft: NFTData;
  onMintClick?: (nft: NFTData) => void;
  showMintButton?: boolean;
}

export default function NFTCard({ nft, onMintClick, showMintButton = true }: NFTCardProps) {
  return (
    <div className="w-full bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg overflow-hidden hover:border-pxusd-orange-400/50 transition-colors">
      {/* NFT Info */}
      <div className="p-4 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{nft.name}</h3>

        {/* NFT Image + Stats */}
        <div className="flex flex-col items-center">
          <div className="w-96">
            <div className="flex items-center justify-center p-4 bg-pxusd-teal-800/50 rounded-t-lg">
              <div className="w-96 h-96 rounded-2xl overflow-hidden">
                <img
                  src={nft.image}
                  alt={nft.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="bg-pxusd-teal-900/60 rounded-b-lg p-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Wallet balance:</span>
                <span className="text-foreground">{Math.floor(nft.mockBalance)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Action:</span>
                <span className="text-foreground">{nft.action}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Token:</span>
                <span className="text-foreground">{nft.tokenName}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Price:</span>
                <span className="text-foreground">{nft.mockTokenPrice.toLocaleString()} {nft.tokenName} (${(nft.mockTokenPrice * nft.mockPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mint button */}
        {showMintButton && onMintClick && (
          <div className="flex justify-center">
            <button
              onClick={() => onMintClick(nft)}
              className="w-96 phoenix-btn-primary py-2 text-sm font-medium rounded-lg"
            >
              Mint
            </button>
          </div>
        )}

        {/* Reason */}
        <p className="text-sm text-muted-foreground italic">{nft.reason}</p>
      </div>
    </div>
  );
}
