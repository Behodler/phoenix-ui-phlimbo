import ConfirmationDialog from '../ui/ConfirmationDialog';

interface DepositToYieldConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  depositAmount: number;
  isLoading?: boolean;
}

export default function DepositToYieldConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  depositAmount,
  isLoading = false
}: DepositToYieldConfirmationDialogProps) {
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
      title="Confirm Deposit"
      confirmLabel="Confirm Deposit"
      isLoading={isLoading}
    >
      <div className="space-y-4">
        {/* Deposit Summary */}
        <div className="bg-pxusd-teal-700 rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">You're depositing</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">{formatNumber(depositAmount)} phUSD</span>
            <span className="text-sm text-muted-foreground">${formatNumber(depositAmount)}</span>
          </div>
        </div>

        {/* Yield Earning Explanation */}
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-pxusd-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-foreground">
              Your phUSD will earn yield in both <span className="font-semibold text-pxusd-teal-300">phUSD</span> and <span className="font-semibold text-pxusd-teal-300">USDC</span>
            </span>
          </div>
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-foreground">
              You can withdraw at any time with <span className="font-semibold text-green-400">no exit or entry fees</span>
            </span>
          </div>
        </div>

        {/* Info notice */}
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-500 rounded-lg p-3">
          <div className="text-pxusd-teal-300 text-sm">
            Your deposit will start earning yield immediately after confirmation.
          </div>
        </div>
      </div>
    </ConfirmationDialog>
  );
}

export { DepositToYieldConfirmationDialog };
