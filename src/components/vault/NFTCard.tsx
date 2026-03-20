import type { NFTData } from '../../data/nftMockData';

interface NFTCardProps {
  nft: NFTData;
  price?: number | null;
  onMintClick?: (nft: NFTData) => void;
  showMintButton?: boolean;
  tokenAddress?: string;
}

export default function NFTCard({ nft, price, onMintClick, showMintButton = true, tokenAddress }: NFTCardProps) {
  const tokenPrice = parseFloat(nft.price);
  const dollarValue = price != null
    ? (tokenPrice * price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  const growthPercent = (nft.growthBasisPoints / 100).toFixed(2);

  // Format balance for display — use full precision for low-decimal tokens like WBTC (8)
  const maxFractionDigits = nft.decimals <= 8 ? nft.decimals : 4;
  const balanceDisplay = parseFloat(nft.balance).toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
  const priceDisplay = parseFloat(nft.price).toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });

  return (
    <div className="w-full bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg overflow-hidden hover:border-pxusd-orange-400/50 transition-colors">
      {/* NFT Info */}
      <div className="p-4 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{nft.name}</h3>

        {/* NFT Image + Stats */}
        <div className="flex flex-col items-center">
          <div className="max-w-96 w-full">
            <div className="flex items-center justify-center p-4 bg-pxusd-teal-800/50 rounded-t-lg">
              <div className="w-full aspect-square rounded-2xl overflow-hidden">
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
                {tokenAddress ? (
                  <a
                    href={`https://app.uniswap.org/swap?outputCurrency=${tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pxusd-orange-300 hover:text-pxusd-orange-200 underline"
                  >
                    {nft.tokenDisplayName} balance:
                  </a>
                ) : (
                  <span>{nft.tokenDisplayName} balance:</span>
                )}
                <span className="text-foreground">{balanceDisplay}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Action:</span>
                <span className="text-foreground">{nft.action}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Token:</span>
                <span className="text-foreground">{nft.tokenDisplayName}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Price:</span>
                <span className="text-foreground">
                  {priceDisplay} {nft.tokenDisplayName}
                  {dollarValue !== null && ` ($${dollarValue})`}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Owned:</span>
                <span className={nft.nftBalance > 0 ? "text-green-500" : "text-red-500"}>
                  {nft.nftBalance.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Growth:</span>
                <span className="text-pxusd-orange-300">{growthPercent}%</span>
              </div>
              {nft.totalBurnt !== undefined && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total Burnt:</span>
                  <span className="text-pxusd-yellow-400">
                    {parseFloat(nft.totalBurnt).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mint button */}
        {showMintButton && onMintClick && (
          <div className="flex justify-center">
            <button
              onClick={() => onMintClick(nft)}
              className="max-w-96 w-full phoenix-btn-primary py-2 text-sm font-medium rounded-lg"
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
