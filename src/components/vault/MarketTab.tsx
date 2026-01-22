import ActionButton from '../ui/ActionButton';

// Token addresses for Uniswap URLs
const PHUSD_ADDRESS = '0xf3B5B661b92B75C71fA5Aba8Fd95D7514A9CD605';
const USDS_ADDRESS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';

// Uniswap URLs
const ADD_LIQUIDITY_URL = 'https://app.uniswap.org/positions/create/v4?currencyA=0xa3931d71877c0e7a3148cb7eb4463524fec27fbd&currencyB=0xf3b5b661b92b75c71fa5aba8fd95d7514a9cd605&chain=ethereum&fee={%22feeAmount%22:3000,%22tickSpacing%22:60,%22isDynamic%22:false}&hook=undefined&priceRangeState={%22priceInverted%22:false,%22fullRange%22:false,%22minPrice%22:%22%22,%22maxPrice%22:%22%22,%22initialPrice%22:%22%22,%22inputMode%22:%22price%22}&depositState={%22exactField%22:%22TOKEN0%22,%22exactAmounts%22:{}}';

// Generate swap URL based on buy/sell direction
const getSwapUrl = (isBuy: boolean): string => {
  const inputCurrency = isBuy ? USDS_ADDRESS : PHUSD_ADDRESS;
  const outputCurrency = isBuy ? PHUSD_ADDRESS : USDS_ADDRESS;
  return `https://app.uniswap.org/swap?chain=ethereum&inputCurrency=${inputCurrency}&outputCurrency=${outputCurrency}`;
};

// Simple Uniswap logo as inline SVG
const UniswapLogo = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
    <path
      d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z"
      fill="#FF007A"
    />
    <path
      d="M8.96 5.84C8.77 5.86 8.45 5.91 8.24 5.94C6.92 6.17 5.69 6.84 4.77 7.82C4.3 8.32 3.94 8.87 3.68 9.47C3.28 10.37 3.13 11.08 3.13 12.05C3.14 12.8 3.24 13.35 3.48 14.03C3.91 15.24 4.66 16.24 5.7 16.99C6.12 17.29 6.87 17.65 7.38 17.78C7.63 17.84 7.68 17.84 7.68 17.78C7.68 17.73 7.43 17.31 7.12 16.85C6.56 16.01 6.35 15.6 6.16 15.04C5.88 14.22 5.82 13.72 5.89 12.86C5.99 11.7 6.36 10.73 7.04 9.82C7.4 9.34 8.07 8.72 8.57 8.38C9.24 7.92 10.11 7.52 10.87 7.32C11.22 7.22 11.84 7.12 12.14 7.12C12.34 7.12 12.35 7.11 12.26 7.04C12.2 7 11.59 6.71 10.91 6.41C9.96 5.99 9.6 5.84 9.46 5.82C9.3 5.8 9.17 5.81 8.96 5.84Z"
      fill="white"
    />
    <path
      d="M13.56 7.79C13.41 7.88 13.41 7.88 13.61 7.92C14.23 8.02 15.03 8.38 15.6 8.82C16.12 9.22 16.68 9.89 16.97 10.47C17.39 11.28 17.54 11.92 17.54 12.79C17.54 13.82 17.3 14.62 16.75 15.45C16.35 16.05 15.67 16.68 15.05 17.05C14.71 17.25 14.03 17.54 13.69 17.62C13.45 17.68 13.45 17.68 13.57 17.78C13.65 17.84 14.38 18.16 15.19 18.49C16.52 19.03 16.74 19.11 16.96 19.14C17.29 19.18 17.66 19.12 17.96 18.98C18.67 18.66 19.42 17.97 19.93 17.17C20.41 16.42 20.73 15.58 20.89 14.67C21 14.04 21.01 12.98 20.92 12.32C20.65 10.3 19.69 8.55 18.17 7.25C17.16 6.37 15.91 5.73 14.6 5.42C14.16 5.32 13.94 5.29 13.41 5.26C12.68 5.22 12.2 5.26 11.49 5.42C10.52 5.65 9.53 6.08 8.72 6.62C8.54 6.74 8.43 6.84 8.47 6.84C8.54 6.84 9.47 6.88 9.84 6.92C10.87 7.02 11.9 7.28 12.78 7.66C13.11 7.8 13.56 7.79 13.56 7.79Z"
      fill="white"
    />
  </svg>
);

// Props interface for MarketTab
interface MarketTabProps {
  price: number | null;
  isLoading: boolean;
  isError: boolean;
}

export default function MarketTab({ price, isLoading, isError }: MarketTabProps) {
  // Determine recommended action based on current price vs mint price ($1)
  // Following the planning doc's economically correct logic:
  // - Price >= $1: SELL opportunity (mint phUSD at $1, sell on Uniswap at premium)
  // - Price < $1: BUY opportunity (buy phUSD at discount on Uniswap)
  const isPriceAboveOrAtDollar = price !== null && price >= 1.0;

  // Format price for display
  const formatPrice = (p: number): string => {
    return `$${p.toFixed(4)}`;
  };

  // Handle swap button click
  const handleSwapClick = () => {
    // isPriceAboveOrAtDollar means sell opportunity (mint at $1, sell higher)
    // price below $1 means buy opportunity (buy cheaper than $1)
    const url = getSwapUrl(!isPriceAboveOrAtDollar); // isBuy = price is below $1
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Handle add liquidity click
  const handleAddLiquidityClick = () => {
    window.open(ADD_LIQUIDITY_URL, '_blank', 'noopener,noreferrer');
  };

  // Determine button label based on price
  const getButtonLabel = (): string => {
    if (isLoading) return 'Loading price...';
    if (isError || price === null) return 'Price unavailable';
    // When price is at or above $1, users should SELL (they minted at $1, can sell at premium)
    // When price is below $1, users should BUY (they can buy at a discount)
    return isPriceAboveOrAtDollar ? 'Sell on Uniswap' : 'Buy on Uniswap';
  };

  return (
    <div className="p-6">
      {/* Info panel at top */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Market</h2>
        <p className="text-sm text-muted-foreground">
          Trade phUSD on Uniswap or provide liquidity to earn fees.
        </p>
      </div>

      {/* Uniswap trading info panel */}
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <UniswapLogo />
          <h3 className="text-lg font-semibold text-pxusd-orange-300">phUSD trades on Uniswap</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          phUSD is available on Uniswap V4. When the market price differs from the $1 mint price,
          arbitrage opportunities exist.
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

        {/* Price context */}
        {!isLoading && !isError && price !== null && (
          <div className="mt-3 pt-3 border-t border-pxusd-teal-600">
            <p className="text-xs text-muted-foreground">
              {isPriceAboveOrAtDollar
                ? 'Price is at or above $1.00 - You can mint phUSD at $1 and sell at a premium on Uniswap.'
                : 'Price is below $1.00 - You can buy phUSD at a discount on Uniswap.'}
            </p>
          </div>
        )}
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
          <UniswapLogo />
          <span>Add Liquidity on Uniswap</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
