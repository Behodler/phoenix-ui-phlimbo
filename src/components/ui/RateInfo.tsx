import type { RateInfoProps } from '../../types/vault';

export default function RateInfo({
  constants,
  slippageBps,
  onSlippageChange,
  minReceived,
  invertRate = false,
  outputToken = "phUSD"
}: RateInfoProps) {
  // Price of 0 indicates loading or error state
  const isLoadingPrice = constants.dolaToPhUSDRate === 0;

  // Calculate display based on invertRate flag
  // For deposit (invertRate=false): "1 DOLA = X phUSD" where X = 1/price
  // For withdraw (invertRate=true): "1 phUSD = Y DOLA" where Y = price
  let displayLabel: string;
  let displayPrice: string;

  if (invertRate) {
    // Withdraw: Show "1 phUSD = Y DOLA"
    displayLabel = "1 phUSD";
    displayPrice = isLoadingPrice ? "Loading..." : `≈ ${constants.dolaToPhUSDRate.toFixed(6)} DOLA`;
  } else {
    // Deposit: Show "1 DOLA = X phUSD"
    displayLabel = "1 DOLA";
    displayPrice = isLoadingPrice ? "Loading..." : `≈ ${constants.dolaToPhUSDRate.toFixed(6)} phUSD`;
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{displayLabel}</span>
        <span className="font-medium text-foreground">{displayPrice}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Max Slippage</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            className="w-16 sm:w-20 rounded-md border border-input bg-card px-2 py-1 text-right text-xs sm:text-sm text-card-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={(slippageBps / 100).toFixed(2)}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) onSlippageChange(Math.max(0, Math.round(val * 100)));
            }}
          />
          <span className="text-muted-foreground text-xs sm:text-sm">%</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Receive at least</span>
        <span className="font-medium text-foreground">
          {minReceived > 0 ? minReceived.toFixed(6) : "-"} {outputToken}
        </span>
      </div>
    </div>
  );
}