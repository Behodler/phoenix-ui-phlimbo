import ActionButton from '../ui/ActionButton';
import balancerLogoSvg from '../../assets/balancer-logo.svg';

// Balancer URLs
const SWAP_URL = 'https://balancer.fi/pools/ethereum/v3/0x5b26d938f0be6357c39e936cc9c2277b9334ea58/swap';
const ADD_LIQUIDITY_URL = 'https://balancer.fi/pools/ethereum/v3/0x5b26d938f0be6357c39e936cc9c2277b9334ea58/add-liquidity';

// Balancer logo component
const BalancerLogo = () => (
  <img src={balancerLogoSvg} alt="Balancer" className="w-5 h-5" />
);

// Props interface for MarketTab
interface MarketTabProps {
  price: number | null;
  isLoading: boolean;
  isError: boolean;
}

export default function MarketTab({ price, isLoading, isError }: MarketTabProps) {
  // Determine action based on current price vs $1
  const isPriceAboveOrAtDollar = price !== null && price >= 1.0;

  // Format price for display
  const formatPrice = (p: number): string => {
    return `$${p.toFixed(4)}`;
  };

  // Handle swap button click
  const handleSwapClick = () => {
    window.open(SWAP_URL, '_blank', 'noopener,noreferrer');
  };

  // Handle add liquidity click
  const handleAddLiquidityClick = () => {
    window.open(ADD_LIQUIDITY_URL, '_blank', 'noopener,noreferrer');
  };

  // Determine button label based on price
  const getButtonLabel = (): string => {
    if (isLoading) return 'Loading price...';
    if (isError || price === null) return 'Price unavailable';
    return isPriceAboveOrAtDollar ? 'Sell on Balancer' : 'Buy on Balancer';
  };

  return (
    <div className="p-6">
      {/* Info panel at top */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Market</h2>
        <p className="text-sm text-muted-foreground">
          Trade phUSD on Balancer or provide liquidity to earn fees.
        </p>
      </div>

      {/* Balancer trading info panel */}
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <BalancerLogo />
          <h3 className="text-lg font-semibold text-pxusd-orange-300">phUSD trades on Balancer</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          phUSD is available on Balancer V3.
        </p>
      </div>

      {/* Price ticker */}
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-foreground text-sm">Current Market Price:</span>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-pxusd-orange-300 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-muted-foreground">Loading...</span>
              </div>
            ) : isError || price === null ? (
              <span className="text-red-400">Unable to fetch price</span>
            ) : (
              <span className={`text-2xl font-bold ${isPriceAboveOrAtDollar ? 'text-pxusd-green-400' : 'text-pxusd-pink-400'}`}>
                {formatPrice(price)}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Action button */}
      <ActionButton
        disabled={isLoading || isError || price === null}
        onAction={handleSwapClick}
        label={getButtonLabel()}
        variant="primary"
        isLoading={isLoading}
      />

      {/* Add liquidity section */}
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Or add liquidity to earn trading fees
        </p>
        <button
          onClick={handleAddLiquidityClick}
          className="inline-flex items-center gap-2 text-pxusd-orange-300 hover:text-pxusd-orange-200 transition-colors text-sm font-medium"
        >
          <BalancerLogo />
          <span>Add Liquidity on Balancer</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
