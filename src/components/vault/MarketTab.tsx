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

// Uniswap unicorn logo as inline SVG
const UniswapLogo = () => (
  <svg viewBox="0 0 168.3 193.8" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
    <path fill="#FF007A" d="M66,44.1c-2.1-0.3-2.2-0.4-1.2-0.5c1.9-0.3,6.3,0.1,9.4,0.8c7.2,1.7,13.7,6.1,20.6,13.8l1.8,2.1l2.6-0.4
      c11.1-1.8,22.5-0.4,32,4c2.6,1.2,6.7,3.6,7.2,4.2c0.2,0.2,0.5,1.5,0.7,2.8c0.7,4.7,0.4,8.2-1.1,10.9c-0.8,1.5-0.8,1.9-0.3,3.2
      c0.4,1,1.6,1.7,2.7,1.7c2.4,0,4.9-3.8,6.1-9.1l0.5-2.1l0.9,1c5.1,5.7,9.1,13.6,9.7,19.2l0.2,1.5l-0.9-1.3c-1.5-2.3-2.9-3.8-4.8-5.1
      c-3.4-2.3-7-3-16.5-3.5c-8.6-0.5-13.5-1.2-18.3-2.8c-8.2-2.7-12.4-6.2-22.1-19.1c-4.3-5.7-7-8.8-9.7-11.4
      C79.6,48.3,73.7,45.3,66,44.1z"/>
    <path fill="#FF007A" d="M140.5,56.8c0.2-3.8,0.7-6.3,1.8-8.6c0.4-0.9,0.8-1.7,0.9-1.7c0.1,0-0.1,0.7-0.4,1.5c-0.8,2.2-0.9,5.3-0.4,8.8
      c0.7,4.5,1,5.1,5.8,10c2.2,2.3,4.8,5.2,5.8,6.4l1.7,2.2l-1.7-1.6c-2.1-2-6.9-5.8-8-6.3c-0.7-0.4-0.8-0.4-1.3,0.1
      c-0.4,0.4-0.5,1-0.5,3.9c-0.1,4.5-0.7,7.3-2.2,10.2c-0.8,1.5-0.9,1.2-0.2-0.5c0.5-1.3,0.6-1.9,0.6-6.2c0-8.7-1-10.8-7.1-14.3
      c-1.5-0.9-4.1-2.2-5.6-2.9c-1.6-0.7-2.8-1.3-2.7-1.3c0.2-0.2,6.1,1.5,8.4,2.5c3.5,1.4,4.1,1.5,4.5,1.4
      C140.2,60.1,140.4,59.3,140.5,56.8z"/>
    <path fill="#FF007A" d="M70.1,71.7c-4.2-5.8-6.9-14.8-6.3-21.5l0.2-2.1l1,0.2c1.8,0.3,4.9,1.5,6.4,2.4c4,2.4,5.8,5.7,7.5,13.9
      c0.5,2.4,1.2,5.2,1.5,6.1c0.5,1.5,2.4,5,4,7.2c1.1,1.6,0.4,2.4-2.1,2.2C78.5,79.7,73.4,76.2,70.1,71.7z"/>
    <path fill="#FF007A" d="M135.4,115.2c-19.8-8-26.8-14.9-26.8-26.6c0-1.7,0.1-3.1,0.1-3.1c0.1,0,0.8,0.6,1.7,1.3c4,3.2,8.5,4.6,21,6.4
      c7.3,1.1,11.5,1.9,15.3,3.2c12.1,4,19.6,12.2,21.4,23.3c0.5,3.2,0.2,9.3-0.6,12.5c-0.7,2.5-2.7,7.1-3.2,7.2c-0.1,0-0.3-0.5-0.3-1.3
      c-0.2-4.2-2.3-8.2-5.8-11.3C154,123.2,148.6,120.5,135.4,115.2z"/>
    <path fill="#FF007A" d="M121.4,118.5c-0.2-1.5-0.7-3.4-1-4.2l-0.5-1.5l0.9,1.1c1.3,1.5,2.3,3.3,3.2,5.8c0.7,1.9,0.7,2.5,0.7,5.6
      c0,3-0.1,3.7-0.7,5.4c-1,2.7-2.2,4.6-4.2,6.7c-3.6,3.7-8.3,5.7-15,6.6c-1.2,0.1-4.6,0.4-7.6,0.6c-7.5,0.4-12.5,1.2-17,2.8
      c-0.6,0.2-1.2,0.4-1.3,0.3c-0.2-0.2,2.9-2,5.4-3.2c3.5-1.7,7.1-2.6,15-4c3.9-0.6,7.9-1.4,8.9-1.8C118.1,135.6,123,127.9,121.4,118.5z"/>
    <path fill="#FF007A" d="M130.5,134.6c-2.6-5.7-3.2-11.1-1.8-16.2c0.2-0.5,0.4-1,0.6-1c0.2,0,0.8,0.3,1.4,0.7c1.2,0.8,3.7,2.2,10.1,5.7
      c8.1,4.4,12.7,7.8,15.9,11.7c2.8,3.4,4.5,7.3,5.3,12.1c0.5,2.7,0.2,9.2-0.5,11.9c-2.2,8.5-7.2,15.3-14.5,19.2c-1.1,0.6-2,1-2.1,1
      c-0.1,0,0.3-1,0.9-2.2c2.4-5.1,2.7-10,0.9-15.5c-1.1-3.4-3.4-7.5-8-14.4C133.2,139.6,131.9,137.5,130.5,134.6z"/>
    <path fill="#FF007A" d="M56,165.2c7.4-6.2,16.5-10.6,24.9-12c3.6-0.6,9.6-0.4,12.9,0.5c5.3,1.4,10.1,4.4,12.6,8.1
      c2.4,3.6,3.5,6.7,4.6,13.6c0.4,2.7,0.9,5.5,1,6.1c0.8,3.6,2.4,6.4,4.4,7.9c3.1,2.3,8.5,2.4,13.8,0.4c0.9-0.3,1.7-0.6,1.7-0.5
      c0.2,0.2-2.5,2-4.3,2.9c-2.5,1.3-4.5,1.7-7.2,1.7c-4.8,0-8.9-2.5-12.2-7.5c-0.7-1-2.1-3.9-3.3-6.6c-3.5-8.1-5.3-10.5-9.4-13.2
      c-3.6-2.3-8.2-2.8-11.7-1.1c-4.6,2.2-5.8,8.1-2.6,11.7c1.3,1.5,3.7,2.7,5.7,3c3.7,0.5,6.9-2.4,6.9-6.1c0-2.4-0.9-3.8-3.3-4.9
      c-3.2-1.4-6.7,0.2-6.6,3.3c0,1.3,0.6,2.1,1.9,2.7c0.8,0.4,0.8,0.4,0.2,0.3c-2.9-0.6-3.6-4.2-1.3-6.5c2.8-2.8,8.7-1.6,10.7,2.3
      c0.8,1.6,0.9,4.8,0.2,6.8c-1.7,4.4-6.5,6.7-11.4,5.4c-3.3-0.9-4.7-1.8-8.7-5.9c-7-7.2-9.7-8.6-19.7-10.1l-1.9-0.3L56,165.2z"/>
    <path fillRule="evenodd" clipRule="evenodd" fill="#FF007A" d="M3.4,4.3c23.3,28.3,59.2,72.3,61,74.7c1.5,2,0.9,3.9-1.6,5.3c-1.4,0.8-4.3,1.6-5.7,1.6c-1.6,0-3.5-0.8-4.8-2.1
      c-0.9-0.9-4.8-6.6-13.6-20.3c-6.7-10.5-12.4-19.2-12.5-19.3C25.8,44,25.8,44,38,65.8C45.7,79.5,48.2,84.4,48.2,85c0,1.3-0.4,2-2,3.8
      c-2.7,3-3.9,6.4-4.8,13.5c-1,7.9-3.7,13.5-11.4,23c-4.5,5.6-5.2,6.6-6.3,8.9c-1.4,2.8-1.8,4.4-2,8c-0.2,3.8,0.2,6.2,1.3,9.8
      c1,3.2,2.1,5.3,4.8,9.4c2.3,3.6,3.7,6.3,3.7,7.3c0,0.8,0.2,0.8,3.8,0c8.6-2,15.7-5.4,19.6-9.6c2.4-2.6,3-4,3-7.6
      c0-2.3-0.1-2.8-0.7-4.2c-1-2.2-2.9-4-7-6.8c-5.4-3.7-7.7-6.7-8.3-10.7c-0.5-3.4,0.1-5.7,3.1-12c3.1-6.5,3.9-9.2,4.4-15.8
      c0.3-4.2,0.8-5.9,2-7.2c1.3-1.4,2.4-1.9,5.5-2.3c5.1-0.7,8.4-2,11-4.5c2.3-2.1,3.3-4.2,3.4-7.3l0.1-2.3L70.1,77C65.4,71.6,0.3,0,0,0
      C-0.1,0,1.5,1.9,3.4,4.3z M34.1,146.5c1.1-1.9,0.5-4.3-1.3-5.5c-1.7-1.1-4.3-0.6-4.3,0.9c0,0.4,0.2,0.8,0.8,1c0.9,0.5,1,1,0.3,2.1
      c-0.7,1.1-0.7,2.1,0.2,2.8C31.2,148.9,33.1,148.3,34.1,146.5z"/>
    <path fillRule="evenodd" clipRule="evenodd" fill="#FF007A" d="M74.6,93.9c-2.4,0.7-4.7,3.3-5.4,5.9c-0.4,1.6-0.2,4.5,0.5,5.4c1.1,1.4,2.1,1.8,4.9,1.8
      c5.5,0,10.2-2.4,10.7-5.3c0.5-2.4-1.6-5.7-4.5-7.2C79.3,93.7,76.2,93.4,74.6,93.9z M81,98.9c0.8-1.2,0.5-2.5-1-3.4
      c-2.7-1.7-6.8-0.3-6.8,2.3c0,1.3,2.1,2.7,4.1,2.7C78.6,100.5,80.4,99.7,81,98.9z"/>
  </svg>
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
          phUSD is available on Uniswap V4.
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
