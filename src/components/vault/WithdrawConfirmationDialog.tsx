import { useState, useEffect, useCallback } from 'react';
import ConfirmationDialog from '../ui/ConfirmationDialog';

interface WithdrawConfirmationData {
  inputAmount: number;
  inputToken: string;
  outputAmount: number;
  outputToken: string;
  priceImpact: number;
  slippage: number;
  feeAmount: number;
  feeRate: number;
  amountAfterFee: number;
  marginalPrice: number; // Price of 1 phUSD in DOLA (e.g., 0.81 means 1 phUSD = 0.81 DOLA)
}

interface WithdrawConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (slippageBps: number) => void;
  data: WithdrawConfirmationData;
  isLoading?: boolean;
}

export default function WithdrawConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  data,
  isLoading = false
}: WithdrawConfirmationDialogProps) {
  // State for editable slippage (in basis points)
  const [slippageBps, setSlippageBps] = useState(data.slippage);
  const [slippageInput, setSlippageInput] = useState((data.slippage / 10000 * 100).toFixed(2));
  const [minReceived, setMinReceived] = useState(data.outputAmount * (1 - data.slippage / 10000));

  // Calculate actual slippage required based on price impact
  // This is a simplified calculation - actual slippage should account for:
  // 1. Price impact from the trade size
  // 2. Current market conditions
  // 3. Bonding curve mechanics
  // Both values are kept as decimals for accurate comparison (0.01 = 1%)
  const actualSlippageRequired = data.priceImpact; // Keep as decimal
  const userSlippagePercent = slippageBps / 10000; // Convert bps to decimal (50 bps = 0.005 = 0.5%)
  const isSlippageInsufficient = userSlippagePercent < actualSlippageRequired;

  // Calculate minimum slippage display value, rounded UP to avoid UX confusion
  // Example: If actual requirement is 0.124%, we must display 0.13% (not 0.12%)
  // because users expect the displayed "minimum" to actually work when they use it
  // Formula: Math.ceil(value * 100 * 100) / 100 rounds UP to 2 decimal places
  const minSlippageDisplay = (Math.ceil(actualSlippageRequired * 100 * 100) / 100).toFixed(2);

  // Sync with parent data when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSlippageBps(data.slippage);
      setSlippageInput((data.slippage / 10000 * 100).toFixed(2));
    }
  }, [isOpen, data.slippage]);

  // Debounced calculation of minimum received
  useEffect(() => {
    const timer = setTimeout(() => {
      const newMinReceived = data.outputAmount * (1 - slippageBps / 10000);
      setMinReceived(newMinReceived);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [slippageBps, data.outputAmount]);

  const handleSlippageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSlippageInput(value);

    // Parse and validate the input
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      const bps = Math.round(parsed * 100); // Convert percentage to basis points
      setSlippageBps(bps);
    }
  };

  const handleConfirm = useCallback(() => {
    // Pass the updated slippage back through the confirmation
    onConfirm(slippageBps);
  }, [onConfirm, slippageBps]);

  const formatNumber = (num: number, decimals = 4) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  const formatPercent = (num: number) => {
    // Round UP to 2 decimal places to avoid UX confusion
    // Users need to see the actual minimum slippage value they should use
    // Example: 0.124% should display as 0.13% (not 0.12%)
    // Formula: Math.ceil(value * 100 * 100) / 100 rounds UP to 2 decimal places
    return `${(Math.ceil(num * 100 * 100) / 100).toFixed(2)}%`;
  };

  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Confirm Withdraw"
      confirmLabel="Confirm Withdraw"
      isLoading={isLoading}
      disabled={isSlippageInsufficient}
    >
      <div className="space-y-4">
        {/* Withdraw Summary */}
        <div className="bg-pxusd-teal-700 rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">You're withdrawing</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">{formatNumber(data.inputAmount)} {data.inputToken}</span>
            {/* Calculate dollar value: phUSD quantity × marginal price (price of 1 phUSD in DOLA)
                Since DOLA ≈ $1, this gives us the USD value of the phUSD being withdrawn.
                Example: 123.45 phUSD × 0.81 DOLA/phUSD = 100 DOLA ≈ $100 USD
                Note: This uses the current marginal price, which is an approximation.
                The actual post-trade price may differ due to slippage. */}
            <span className="text-sm text-muted-foreground">${formatNumber(data.inputAmount * data.marginalPrice)}</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" className="text-muted-foreground">
            <path
              fill="currentColor"
              d="M8 4L13 9h-2.5v6h-5V9H3z"
            />
          </svg>
        </div>

        {/* Receive Summary */}
        <div className="bg-pxusd-teal-700 rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">You'll receive</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">{formatNumber(data.outputAmount)} {data.outputToken}</span>
            <span className="text-sm text-muted-foreground">${formatNumber(data.outputAmount)}</span>
          </div>
        </div>

        {/* Fee Breakdown - Only show when fee is non-zero */}
        {data.feeRate !== 0 && (
          <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4">
            <div className="text-sm font-medium text-pxusd-orange-300 mb-2">Fee Breakdown</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground">Withdraw Amount</span>
                <span className="font-medium">{formatNumber(data.inputAmount)} {data.inputToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground">Withdrawal Fee ({formatPercent(data.feeRate)})</span>
                <span className="font-medium text-pxusd-pink-400">-{formatNumber(data.feeAmount)} {data.inputToken}</span>
              </div>
              <div className="border-t border-pxusd-teal-600 pt-2">
                <div className="flex justify-between font-medium">
                  <span className="text-pxusd-orange-300">Amount After Fee</span>
                  <span className="text-pxusd-orange-300">{formatNumber(data.amountAfterFee)} {data.inputToken}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price Impact</span>
            <span className={`${data.priceImpact > 0.05 ? 'text-red-500' : 'text-green-500'}`}>
              {formatPercent(data.priceImpact)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Maximum Slippage</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={slippageInput}
                onChange={handleSlippageChange}
                step="0.01"
                min="0"
                max="100"
                className="w-20 px-2 py-1 text-right bg-pxusd-teal-700 border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span>%</span>
            </div>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Minimum Received</span>
            <span>{formatNumber(minReceived)} {data.outputToken}</span>
          </div>
        </div>

        {/* Warning if high price impact */}
        {data.priceImpact > 0.05 && (
          <div className="bg-pxusd-teal-700 border border-pxusd-pink-400 rounded-lg p-3">
            <div className="text-pxusd-pink-400 text-sm">
              ⚠️ High price impact detected. Consider reducing your withdrawal amount.
            </div>
          </div>
        )}

        {/* Warning if slippage is insufficient */}
        {isSlippageInsufficient && (
          <div className="bg-pxusd-teal-700 border border-pxusd-pink-400 rounded-lg p-3">
            <div className="text-pxusd-pink-400 text-sm">
              ⚠️ Slippage tolerance too low. The current price impact of {(Math.ceil(actualSlippageRequired * 100 * 100) / 100).toFixed(2)}% requires at least {minSlippageDisplay}% slippage tolerance. Please increase your slippage tolerance to continue.
            </div>
          </div>
        )}
      </div>
    </ConfirmationDialog>
  );
}

export { WithdrawConfirmationDialog };