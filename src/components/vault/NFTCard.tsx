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
      <div className="p-3 space-y-3">
        <h3 className="text-base font-semibold text-foreground">{nft.name}</h3>

        {/* Image + Stats — side-by-side on sm+, stacked on mobile */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-shrink-0 w-full sm:w-40 mx-auto sm:mx-0">
            <div className="aspect-square rounded-xl overflow-hidden bg-pxusd-teal-800/50">
              <img
                src={nft.image}
                alt={nft.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 bg-pxusd-teal-900/60 rounded-lg p-3 space-y-1 self-stretch">
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              {tokenAddress ? (
                <a
                  href={`https://app.uniswap.org/swap?outputCurrency=${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pxusd-orange-300 hover:text-pxusd-orange-200 underline truncate"
                >
                  {nft.tokenDisplayName} balance:
                </a>
              ) : (
                <span className="truncate">{nft.tokenDisplayName} balance:</span>
              )}
              <span className="text-foreground tabular-nums">{balanceDisplay}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>Action:</span>
              <span className="text-foreground truncate">{nft.action}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>Token:</span>
              <span className="text-foreground truncate">{nft.tokenDisplayName}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>Price:</span>
              <span className="text-foreground tabular-nums text-right">
                {priceDisplay} {nft.tokenDisplayName}
                {dollarValue !== null && ` ($${dollarValue})`}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>Owned:</span>
              <span className={`tabular-nums ${nft.nftBalance > 0 ? "text-green-500" : "text-red-500"}`}>
                {nft.nftBalance.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span>Growth:</span>
              <span className="text-pxusd-orange-300 tabular-nums">{growthPercent}%</span>
            </div>
            {nft.totalBurnt !== undefined && (
              <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span>Total Burnt:</span>
                <span className="text-pxusd-yellow-400 tabular-nums">
                  {parseFloat(nft.totalBurnt).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mint button */}
        {showMintButton && onMintClick && (
          <button
            onClick={() => onMintClick(nft)}
            className="w-full phoenix-btn-primary py-2 text-sm font-medium rounded-lg"
          >
            Mint
          </button>
        )}

        {/* Reason */}
        <p className="text-xs text-muted-foreground italic">{nft.reason}</p>
      </div>
    </div>
  );
}
