import ConfirmationDialog from '../ui/ConfirmationDialog';

interface WithdrawFromYieldConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  principalAmount: number;
  phUsdYield: number;
  usdcYield: number;
  totalPhUsd: number;
  isLoading?: boolean;
}

export default function WithdrawFromYieldConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  principalAmount,
  phUsdYield,
  usdcYield,
  totalPhUsd,
  isLoading = false
}: WithdrawFromYieldConfirmationDialogProps) {
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
      title="Confirm Withdrawal & Claim"
      confirmLabel="Confirm Withdraw"
      isLoading={isLoading}
    >
      <div className="space-y-4">
        {/* Principal Being Withdrawn */}
        <div className="bg-pxusd-teal-700 rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">Withdrawing principal</div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">{formatNumber(principalAmount)} phUSD</span>
            <span className="text-sm text-muted-foreground">${formatNumber(principalAmount)}</span>
          </div>
        </div>

        {/* Yield Being Claimed */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground">Yield being claimed</div>

          {/* phUSD Yield */}
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-pxusd-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-foreground">
              <span className="font-semibold text-pxusd-teal-300">+{formatNumber(phUsdYield)} phUSD</span>
              <span className="text-muted-foreground"> earned yield</span>
            </span>
          </div>

          {/* USDC Yield */}
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-pxusd-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="text-foreground">
              <span className="font-semibold text-pxusd-teal-300">+{formatNumber(usdcYield)} USDC</span>
              <span className="text-muted-foreground"> earned yield</span>
            </span>
          </div>
        </div>

        {/* Total phUSD Received */}
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-500 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-muted-foreground">Total phUSD to receive</div>
              <div className="text-xs text-muted-foreground">(principal + yield)</div>
            </div>
            <span className="text-xl font-semibold text-pxusd-teal-300">{formatNumber(totalPhUsd)} phUSD</span>
          </div>
        </div>

        {/* Info notice */}
        <div className="flex items-start gap-2 text-sm">
          <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-foreground">
            No fees on withdrawal. Your yield is claimed automatically with your principal.
          </span>
        </div>
      </div>
    </ConfirmationDialog>
  );
}

export { WithdrawFromYieldConfirmationDialog };
