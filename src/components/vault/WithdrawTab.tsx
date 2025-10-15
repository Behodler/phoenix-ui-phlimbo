import { useState } from 'react';
import type { WithdrawFormProps } from '../../types/vault';
import AmountDisplay from '../ui/AmountDisplay';
import TokenRow from '../ui/TokenRow';
import AmountInput from '../ui/AmountInput';
import RateInfo from '../ui/RateInfo';
import ActionButton from '../ui/ActionButton';
import WithdrawConfirmationDialog from './WithdrawConfirmationDialog';
import phUSD from "../../assets/phUSD.png"

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

  // For withdraw: phUSD → DOLA conversion
  // getCurrentMarginalPrice() returns price of 1 phUSD in DOLA
  // If price = 0.81, then 1 phUSD costs 0.81 DOLA
  // To get DOLA from phUSD: DOLA = phUSD * price
  // Calculate 2% withdrawal fee
  const withdrawalFeeRate = 0.02;
  const feeAmount = parsedAmount * withdrawalFeeRate;
  const amountAfterFee = parsedAmount - feeAmount;

  const estDOLA = amountAfterFee * constants.dolaToPhUSDRate;
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
      buttonLabel = "Insufficient phUSD Balance";
    } else if (isAmountValid) {
      buttonLabel = "Withdraw";
      buttonAction = handleInitiateWithdraw;
      buttonLoading = isTransacting;
    }
  }

  // Create token info for phUSD (the token being withdrawn)
  const phUSDTokenInfo = {
    name: "phUSD",
    balance: positionInfo.value,
    balanceUsd: positionInfo.valueUsd,
    icon:phUSD
  };

  return (
    <>
      <div className="p-6">
        <AmountDisplay amount={parsedAmount} />

        <div className="h-px w-full bg-border mb-6" />

        <TokenRow token={phUSDTokenInfo} />

        <AmountInput
          amount={formData.amount}
          onAmountChange={handleAmountChange}
          onMaxClick={handleMaxClick}
        />

        {/* Fee Information Display */}
        {parsedAmount > 0 && (
          <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-3 sm:p-4 mb-4">
            <div className="text-sm font-medium text-pxusd-orange-300 mb-2">Withdrawal Fee</div>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-start">
                <span className="text-foreground flex-shrink-0">Fee ({(withdrawalFeeRate * 100).toFixed(1)}%)</span>
                <span className="font-medium text-pxusd-pink-400 text-right ml-2">{feeAmount.toFixed(4)} {phUSDTokenInfo.name}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-foreground flex-shrink-0">You'll receive</span>
                <span className="font-medium text-pxusd-yellow-400 text-right ml-2">{estDOLA.toFixed(4)} DOLA</span>
              </div>
            </div>
          </div>
        )}

        <RateInfo
          constants={constants}
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
          inputToken: 'phUSD',
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