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
}

interface WithdrawConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
      title="Confirm Withdraw"
      confirmLabel="Confirm Withdraw"
      isLoading={isLoading}
    >
      <div className="space-y-4">
        {/* Withdraw Summary */}
        <div className="bg-muted rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">You're withdrawing</div>
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
              d="M8 4L13 9h-2.5v6h-5V9H3z"
            />
          </svg>
        </div>

        {/* Receive Summary */}
        <div className="bg-muted rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">You'll receive</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">{formatNumber(data.outputAmount)} {data.outputToken}</span>
            <span className="text-sm text-muted-foreground">${formatNumber(data.outputAmount)}</span>
          </div>
        </div>

        {/* Fee Breakdown */}
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
              ⚠️ High price impact detected. Consider reducing your withdrawal amount.
            </div>
          </div>
        )}
      </div>
    </ConfirmationDialog>
  );
}

export { WithdrawConfirmationDialog };