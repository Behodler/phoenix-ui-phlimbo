import { useState, useEffect, useCallback } from 'react';
import ConfirmationDialog from '../ui/ConfirmationDialog';

interface DepositConfirmationData {
  inputAmount: number;
  inputToken: string;
  outputAmount: number;
  outputToken: string;
  priceImpact: number;
  slippage: number;
  marginalPrice: number; // Price of 1 phUSD in DOLA (e.g., 0.81 means 1 phUSD = 0.81 DOLA)
}

interface DepositConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (slippageBps: number) => void;
  data: DepositConfirmationData;
  isLoading?: boolean;
}

export default function DepositConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  data,
  isLoading = false
}: DepositConfirmationDialogProps) {
  // State for editable slippage (in basis points)
  const [slippageBps, setSlippageBps] = useState(data.slippage);
  const [slippageInput, setSlippageInput] = useState((data.slippage / 10000 * 100).toFixed(2));
  const [minReceived, setMinReceived] = useState(data.outputAmount * (1 - data.slippage / 10000));

  // Calculate actual slippage required based on price impact
  // This is a simplified calculation - actual slippage should account for:
  // 1. Price impact from the trade size
  // 2. Current market conditions
  // 3. Bonding curve mechanics
  const actualSlippageRequired = data.priceImpact * 100; // Convert to percentage
  const userSlippagePercent = slippageBps / 10000 * 100;
  const isSlippageInsufficient = userSlippagePercent < actualSlippageRequired;

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
    return `${(num * 100).toFixed(2)}%`;
  };

  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Confirm Deposit"
      confirmLabel="Confirm Deposit"
      isLoading={isLoading}
      disabled={isSlippageInsufficient}
    >
      <div className="space-y-4">
        {/* Deposit Summary */}
        <div className="bg-pxusd-teal-700 rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">You're depositing</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">{formatNumber(data.inputAmount)} {data.inputToken}</span>
            <span className="text-sm text-muted-foreground">${formatNumber(data.inputAmount)}</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" className="text-muted-foreground">
            <path
              fill="currentColor"
              d="M8 12L3 7h2.5V1h5v6H13z"
            />
          </svg>
        </div>

        {/* Receive Summary */}
        <div className="bg-pxusd-teal-700 rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">You'll receive</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">{formatNumber(data.outputAmount)} {data.outputToken}</span>
            {/* Calculate dollar value: phUSD quantity × marginal price (price of 1 phUSD in DOLA)
                Since DOLA ≈ $1, this gives us the USD value of the phUSD received.
                Example: 123.45 phUSD × 0.81 DOLA/phUSD = 100 DOLA ≈ $100 USD
                Note: This uses the current marginal price, which is an approximation.
                The actual post-trade price may differ due to slippage. */}
            <span className="text-sm text-muted-foreground">${formatNumber(data.outputAmount * data.marginalPrice)}</span>
          </div>
        </div>

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
              ⚠️ High price impact detected. Consider reducing your deposit amount.
            </div>
          </div>
        )}

        {/* Warning if slippage is insufficient */}
        {isSlippageInsufficient && (
          <div className="bg-pxusd-teal-700 border border-pxusd-pink-400 rounded-lg p-3">
            <div className="text-pxusd-pink-400 text-sm">
              ⚠️ Slippage tolerance too low. The current price impact of {actualSlippageRequired.toFixed(2)}% requires at least {actualSlippageRequired.toFixed(2)}% slippage tolerance. Please increase your slippage tolerance to continue.
            </div>
          </div>
        )}
      </div>
    </ConfirmationDialog>
  );
}

export { DepositConfirmationDialog };