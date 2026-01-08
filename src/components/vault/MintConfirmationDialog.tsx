import ConfirmationDialog from '../ui/ConfirmationDialog';

interface MintConfirmationData {
  inputAmount: number;
  inputToken: string;
  outputAmount: number;
  outputToken: string;
}

interface MintConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: MintConfirmationData;
  isLoading?: boolean;
}

export default function MintConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  data,
  isLoading = false
}: MintConfirmationDialogProps) {
  const formatNumber = (num: number, decimals = 4) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Confirm Mint"
      confirmLabel="Confirm Mint"
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
            {/* At 1:1 rate, output value equals input value */}
            <span className="text-sm text-muted-foreground">${formatNumber(data.outputAmount)}</span>
          </div>
        </div>

        {/* Transaction Details - simplified for 1:1 minting */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exchange Rate</span>
            <span className="text-green-500">1:1 (Fixed)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Receive</span>
            <span>{formatNumber(data.outputAmount)} {data.outputToken}</span>
          </div>
        </div>

        {/* Info notice about fixed rate */}
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-500 rounded-lg p-3">
          <div className="text-pxusd-teal-300 text-sm">
            This mint uses a fixed 1:1 exchange rate. No slippage or price impact.
          </div>
        </div>
      </div>
    </ConfirmationDialog>
  );
}

export { MintConfirmationDialog };
