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
  onConfirm: () => void;
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
      onConfirm={onConfirm}
      title="Confirm Deposit"
      confirmLabel="Confirm Deposit"
      isLoading={isLoading}
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">Maximum Slippage</span>
            <span>{formatPercent(data.slippage / 10000)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Minimum Received</span>
            <span>{formatNumber(data.outputAmount * (1 - data.slippage / 10000))} {data.outputToken}</span>
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
      </div>
    </ConfirmationDialog>
  );
}

export { DepositConfirmationDialog };