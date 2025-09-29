import { useState } from 'react';
import type { WithdrawFormProps } from '../../types/vault';
import AmountDisplay from '../ui/AmountDisplay';
import TokenRow from '../ui/TokenRow';
import AmountInput from '../ui/AmountInput';
import RateInfo from '../ui/RateInfo';
import ActionButton from '../ui/ActionButton';
import WithdrawConfirmationDialog from './WithdrawConfirmationDialog';

export default function WithdrawTab({
  formData,
  onFormChange,
  constants,
  positionInfo,
  onWithdraw,
  isTransacting = false,
}: WithdrawFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const parsedAmount = Number(formData.amount) || 0;

  // For withdraw, we burn pxUSD to get DOLA
  // The rate should be inverse of deposit (pxUSD to DOLA)
  const pxUSDToDolaRate = 1 / constants.dolaToPxUSDRate;

  // Calculate 2% withdrawal fee
  const withdrawalFeeRate = 0.02;
  const feeAmount = parsedAmount * withdrawalFeeRate;
  const amountAfterFee = parsedAmount - feeAmount;

  const estDOLA = amountAfterFee * pxUSDToDolaRate;
  const minReceived = estDOLA * (1 - formData.slippageBps / 10000);

  // Calculate price impact (mock calculation for demonstration)
  const priceImpact = Math.min(parsedAmount / 10000, 0.1); // Simple price impact based on amount

  const handleAmountChange = (amount: string) => {
    onFormChange({ amount });
  };

  const handleSlippageChange = (slippageBps: number) => {
    onFormChange({ slippageBps });
  };

  const handleMaxClick = () => {
    // Set max amount to the full available balance
    // User will see the fee deduction in the confirmation
    onFormChange({ amount: positionInfo.value.toString() });
  };

  const handleInitiateWithdraw = () => {
    setShowConfirmation(true);
  };

  const handleConfirmWithdraw = async () => {
    setShowConfirmation(false);
    onWithdraw();
  };

  const handleCancelWithdraw = () => {
    setShowConfirmation(false);
  };

  // Determine button state and properties
  // Validate that user has sufficient balance for the withdrawal amount (fee is deducted from output)
  const isAmountValid = parsedAmount > 0 && parsedAmount <= positionInfo.value;
  const buttonDisabled = !isAmountValid || isTransacting;

  let buttonLabel = "Enter Amount";
  let buttonVariant: 'primary' | 'approve' = 'primary';
  let buttonAction = handleInitiateWithdraw;
  let buttonLoading = false;

  if (parsedAmount > 0) {
    if (parsedAmount > positionInfo.value) {
      buttonLabel = "Insufficient pxUSD Balance";
    } else if (isAmountValid) {
      buttonLabel = "Withdraw";
      buttonAction = handleInitiateWithdraw;
      buttonLoading = isTransacting;
    }
  }

  // Create token info for pxUSD (the token being withdrawn)
  const pxUSDTokenInfo = {
    name: "pxUSD",
    balance: positionInfo.value,
    balanceUsd: positionInfo.valueUsd,
  };

  return (
    <>
      <div className="p-6">
        <AmountDisplay amount={parsedAmount} />

        <div className="h-px w-full bg-border mb-6" />

        <TokenRow token={pxUSDTokenInfo} />

        <AmountInput
          amount={formData.amount}
          onAmountChange={handleAmountChange}
          onMaxClick={handleMaxClick}
        />

        {/* Fee Information Display */}
        {parsedAmount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4 mb-4">
            <div className="text-sm font-medium text-orange-800 mb-2">Withdrawal Fee</div>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-start">
                <span className="text-orange-700 flex-shrink-0">Fee ({(withdrawalFeeRate * 100).toFixed(1)}%)</span>
                <span className="font-medium text-red-600 text-right ml-2">{feeAmount.toFixed(4)} {pxUSDTokenInfo.name}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-orange-700 flex-shrink-0">You'll receive</span>
                <span className="font-medium text-green-600 text-right ml-2">{estDOLA.toFixed(4)} DOLA</span>
              </div>
            </div>
          </div>
        )}

        <RateInfo
          constants={{
            dolaToPxUSDRate: pxUSDToDolaRate, // Use inverse rate for withdraw
          }}
          slippageBps={formData.slippageBps}
          onSlippageChange={handleSlippageChange}
          minReceived={minReceived}
        />

        <ActionButton
          disabled={buttonDisabled}
          onAction={buttonAction}
          label={buttonLabel}
          variant={buttonVariant}
          isLoading={buttonLoading}
        />
      </div>

      <WithdrawConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCancelWithdraw}
        onConfirm={handleConfirmWithdraw}
        isLoading={isTransacting}
        data={{
          inputAmount: parsedAmount,
          inputToken: 'pxUSD',
          outputAmount: estDOLA,
          outputToken: 'DOLA',
          priceImpact: priceImpact,
          slippage: formData.slippageBps,
          feeAmount: feeAmount,
          feeRate: withdrawalFeeRate,
          amountAfterFee: amountAfterFee,
        }}
      />
    </>
  );
}